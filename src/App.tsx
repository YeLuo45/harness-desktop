import { useEffect, useState, useRef, useCallback } from 'react'
import { useAppStore } from './store/appStore'
import { useConfigStore } from './store/configStore'
import { initLLMBridge, getLLMBridge, LLMBridge } from './services/llmBridge'
import { initContextManager, getContextManager } from './services/contextManager'
import { getVerificationHooks } from './services/verificationHooks'
import { MVP_TOOLS } from './services/modelAdapters'
import type { Message, ToolResult, ExecutionPlan, PlanStep, ChatMessage } from './types'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import ChatMessages from './components/ChatMessages'
import ChatInput from './components/ChatInput'
import PlanView from './components/PlanView'
import SettingsPanel from './components/SettingsPanel'
import WelcomeScreen from './components/WelcomeScreen'

type View = 'chat' | 'settings'

function App() {
  const [view, setView] = useState<View>('chat')
  const [showPlan, setShowPlan] = useState(false)

  const {
    messages,
    addMessage,
    updateMessage,
    isLoading,
    setLoading,
    mode,
    setMode,
    currentPlan,
    setPlan,
    updatePlanStep,
    addWarning,
    clearWarnings
  } = useAppStore()

  const { config, loadConfig } = useConfigStore()

  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize on mount
  useEffect(() => {
    loadConfig()
    initContextManager()
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize LLM bridge when config changes
  useEffect(() => {
    if (config.apiKey && config.model && config.modelEndpoint) {
      initLLMBridge(config.model, config.apiKey, config.modelEndpoint, config.modelName)
    }
  }, [config.apiKey, config.model, config.modelEndpoint, config.modelName])

  // Execute a single tool call
  const executeTool = useCallback(async (
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> => {
    const electronAPI = (window as any).electronAPI
    if (!electronAPI) {
      return {
        toolName,
        arguments: args,
        result: null,
        success: false,
        error: 'Electron API not available',
        timestamp: Date.now()
      }
    }

    const riskLevel =
      toolName === 'bash_execute' ? 'high' :
      ['file_write', 'file_append'].includes(toolName) ? 'medium' : 'low'

    const response = await electronAPI.tool.execute({ name: toolName, arguments: args, riskLevel })

    return {
      toolName,
      arguments: args,
      result: response.result,
      success: response.success,
      error: response.error,
      timestamp: Date.now()
    }
  }, [])

  // Execute a plan step
  const executePlanStep = useCallback(async (step: PlanStep): Promise<ToolResult> => {
    updatePlanStep(step.id, { status: 'executing' })

    const result = await executeTool(step.toolName, step.arguments)

    updatePlanStep(step.id, {
      status: result.success ? 'completed' : 'failed',
      result: result.result,
      error: result.error
    })

    // Run verification
    const verification = getVerificationHooks()
    const verificationResult = verification.verify(result)

    if (!verificationResult.passed || verificationResult.warnings.length > 0) {
      const msg = verification.formatVerificationMessage(verificationResult)
      if (msg) {
        addWarning({
          toolName: step.toolName,
          message: msg,
          severity: verificationResult.passed ? 'warning' : 'error'
        })
      }
    }

    return result
  }, [executeTool, updatePlanStep, addWarning])

  // Execute an entire plan
  const executePlan = useCallback(async (plan: ExecutionPlan) => {
    const results: ToolResult[] = []
    const contextManager = getContextManager()

    for (const step of plan.steps) {
      if (step.status === 'skipped') continue

      // Check if we need confirmation for medium/high risk steps
      if (step.riskLevel === 'medium' && config.riskConfirmation.medium) {
        // For now, auto-proceed - in a full implementation, this would prompt
      }
      if (step.riskLevel === 'high' && config.riskConfirmation.high) {
        // Same as above
      }

      const result = await executePlanStep(step)
      results.push(result)
      contextManager.addToolCall(step.toolName, step.arguments, result)
    }

    return results
  }, [executePlanStep, config.riskConfirmation])

  // Process assistant response for tool calls
  const processToolCalls = useCallback(async (
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
    assistantMessageId: string
  ): Promise<string> => {
    const results: ToolResult[] = []
    const contextManager = getContextManager()

    // Execute tool calls in sequence for now (can be parallelized)
    for (const tc of toolCalls) {
      const result = await executeTool(tc.name, tc.arguments)
      results.push(result)
      contextManager.addToolCall(tc.name, tc.arguments, result)

      // Update message with tool results
      updateMessage(assistantMessageId, {
        toolResults: [...(messages.find(m => m.id === assistantMessageId)?.toolResults || []), result]
      })

      // Verification
      const verification = getVerificationHooks()
      const verificationResult = verification.verify(result)

      if (!verificationResult.passed || verificationResult.warnings.length > 0) {
        const msg = verification.formatVerificationMessage(verificationResult)
        if (msg) {
          addWarning({
            toolName: tc.name,
            message: msg,
            severity: verificationResult.passed ? 'warning' : 'error'
          })
        }
      }
    }

    // Build result summary
    const summaryParts = results.map(r =>
      `${r.toolName}: ${r.success ? '✓' : '✗'}`
    )

    return summaryParts.join(', ')
  }, [executeTool, updateMessage, messages, addWarning])

  // Handle user input
  const handleUserInput = useCallback(async (input: string) => {
    if (!input.trim()) return

    clearWarnings()
    setLoading(true)

    const contextManager = getContextManager()
    const bridge = getLLMBridge()

    // Check if API is configured
    if (!bridge || !config.apiKey) {
      addMessage({
        role: 'assistant',
        content: 'Please configure your API key in Settings before using the assistant.'
      })
      setLoading(false)
      return
    }

    // Get system prompt
    const electronAPI = (window as any).electronAPI
    let systemPrompt = ''
    if (electronAPI) {
      systemPrompt = await electronAPI.systemPrompt.getFixed()
      const dynamicPrompt = await electronAPI.systemPrompt.buildDynamic({
        currentTime: new Date().toISOString(),
        workDir: config.workDir || 'Not set'
      })
      systemPrompt = systemPrompt + '\n\n' + dynamicPrompt
    }

    bridge.setSystemPrompt(systemPrompt)

    // Add user message
    contextManager.addUserInput(input)
    addMessage({ role: 'user', content: input })

    // Build messages for LLM
    const chatMessages = contextManager.buildMessages(systemPrompt, input)

    // Check if we should use planning mode
    const shouldPlan = await bridge.shouldUsePlanningMode(chatMessages)

    if (shouldPlan) {
      setMode('planning')
      setLoading(false)

      // Generate plan
      const plan = await bridge.generatePlan(chatMessages)
      setPlan(plan)
      setShowPlan(true)

      addMessage({
        role: 'assistant',
        content: `I've analyzed your request and created an execution plan with ${plan.totalSteps} steps. Please review and confirm.`,
        plan
      })
      return
    }

    // Direct execution mode
    setMode('execution')

    // Create assistant message placeholder
    const assistantMsgId = `msg-${Date.now()}`
    addMessage({
      role: 'assistant',
      content: '',
      toolCalls: []
    })

    let fullContent = ''

    try {
      const response = await bridge.chat(chatMessages, {
        onChunk: (chunk) => {
          fullContent += chunk
          updateMessage(assistantMsgId, { content: fullContent })
        },
        onComplete: () => {
          updateMessage(assistantMsgId, { content: fullContent })
        },
        onError: (error) => {
          updateMessage(assistantMsgId, {
            content: `Error: ${error.message}`
          })
        },
        onToolCalls: (toolCalls) => {
          if (toolCalls.length > 0) {
            updateMessage(assistantMsgId, { toolCalls })
          }
        }
      })

      // Process any tool calls returned
      if (response.toolCalls && response.toolCalls.length > 0) {
        const summary = await processToolCalls(response.toolCalls, assistantMsgId)
        const finalContent = fullContent + `\n\n[Tools executed: ${summary}]`
        updateMessage(assistantMsgId, { content: finalContent })
      }

      contextManager.addAssistantResponse(fullContent, [])
    } catch (error: any) {
      updateMessage(assistantMsgId, {
        content: `Error: ${error.message}`
      })
    }

    // Check if context needs compression
    if (contextManager.needsCompression()) {
      const { compressedCount, remainingCount } = contextManager.compress()
      console.log(`Context compressed: ${compressedCount} items removed, ${remainingCount} remaining`)
    }

    setLoading(false)
  }, [config, addMessage, updateMessage, setLoading, setMode, setPlan, clearWarnings, processToolCalls])

  // Confirm plan execution
  const handlePlanConfirm = useCallback(async () => {
    if (!currentPlan) return

    setShowPlan(false)
    setLoading(true)

    // Mark plan as confirmed
    setPlan({ ...currentPlan, confirmed: true })

    // Update mode to execution
    setMode('execution')

    // Execute the plan
    const results = await executePlan(currentPlan)

    // Build summary message
    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    addMessage({
      role: 'assistant',
      content: `Plan executed.\n\n✅ ${succeeded} step(s) completed successfully${failed > 0 ? `\n❌ ${failed} step(s) failed` : ''}`,
      mode: 'execution'
    })

    setLoading(false)
  }, [currentPlan, executePlan, addMessage, setMode, setPlan, setLoading])

  // Cancel plan
  const handlePlanCancel = useCallback(() => {
    setShowPlan(false)
    setPlan(null)
    setMode('execution')
    addMessage({
      role: 'assistant',
      content: 'Plan cancelled. Let me know if you have another request.'
    })
  }, [setPlan, setMode, addMessage])

  return (
    <div className="app-container">
      <Header onSettingsClick={() => setView(view === 'settings' ? 'chat' : 'settings')} />

      <div className="main-content">
        {view === 'chat' && (
          <>
            <Sidebar />
            <div className="chat-container">
              {messages.length === 0 ? (
                <WelcomeScreen onStart={() => {/* Focus input */}} />
              ) : (
                <>
                  <ChatMessages messages={messages} />
                  {showPlan && currentPlan && (
                    <PlanView
                      plan={currentPlan}
                      onConfirm={handlePlanConfirm}
                      onCancel={handlePlanCancel}
                    />
                  )}
                </>
              )}
              <ChatInput
                onSend={handleUserInput}
                disabled={isLoading || showPlan}
                placeholder={showPlan ? 'Waiting for plan confirmation...' : 'Ask me anything or tell me what to do...'}
              />
              <div ref={messagesEndRef} />
            </div>
          </>
        )}

        {view === 'settings' && (
          <SettingsPanel />
        )}
      </div>
    </div>
  )
}

export default App
