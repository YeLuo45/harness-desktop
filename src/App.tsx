import { useEffect, useState, useRef, useCallback } from 'react'
import { useAppStore } from './store/appStore'
import { useConfigStore } from './store/configStore'
import { initLLMBridge, getLLMBridge, LLMBridge } from './services/llmBridge'
import { initContextManager, getContextManager } from './services/contextManager'
import { getVerificationHooks, initVerificationHooks } from './services/verificationHooks'
import { initSubAgentManager, getSubAgentManager } from './services/subAgentManager'
import { initMultiAgentEngine, getMultiAgentEngine } from './services/multiAgentEngine'
import { useCollaborationEvents } from './services/multiAgent'
import { V2_TOOLS } from './services/modelAdapters'
import type { Message, ToolResult, ExecutionPlan, PlanStep, ChatMessage, VerificationConfig, SubAgentResult } from './types'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import ChatMessages from './components/ChatMessages'
import ChatInput from './components/ChatInput'
import PlanView from './components/PlanView'
import CollaborationView, { agentsToCollaborationView, getActiveTasks } from './components/CollaborationView'
import SettingsPanel from './components/SettingsPanel'
import WelcomeScreen from './components/WelcomeScreen'
import { LogViewer } from './components/LogViewer'

type View = 'chat' | 'settings'

function App() {
  const [view, setView] = useState<View>('chat')
  const [showPlan, setShowPlan] = useState(false)
  const [isPlanExecuting, setIsPlanExecuting] = useState(false)
  // v2: Track sub-agent status
  const [subAgentStatus, setSubAgentStatus] = useState<string>('')
  const [showLogViewer, setShowLogViewer] = useState(false)
  // v2: Collaboration mode
  const [showCollaboration, setShowCollaboration] = useState(false)

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
    clearWarnings,
    isCollaborationActive,
    activeAgents,
    setCollaborationActive
  } = useAppStore()

  const { config, loadConfig } = useConfigStore()

  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize on mount
  useEffect(() => {
    loadConfig()
    initContextManager()

    // v2: Restore memory from long-term storage
    const restoreMemory = async () => {
      const contextManager = getContextManager()
      const restored = await contextManager.restoreFromLongTerm()
      if (restored > 0) {
        console.log(`[LongTermMemory] Restored ${restored} memory pointers`)
      }
    }
    restoreMemory()

    // v2: Initialize verification hooks with config
    const verificationConfig: VerificationConfig = {
      level: config.verification?.level || 'loose',
      autoRetry: config.verification?.autoRetry ?? true,
      maxRetries: config.verification?.maxRetries ?? 3,
      degradeOnFailure: config.verification?.degradeOnFailure ?? true
    }
    initVerificationHooks(verificationConfig)
  }, [])

  // Persist memory to long-term storage on page unload
  useEffect(() => {
    const persistOnUnload = () => {
      const contextManager = getContextManager()
      contextManager.persistToLongTerm()
    }

    window.addEventListener('beforeunload', persistOnUnload)
    return () => {
      window.removeEventListener('beforeunload', persistOnUnload)
    }
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Bridge CollaborationManager events → React state
  useCollaborationEvents()

  // Initialize LLM bridge when config changes
  useEffect(() => {
    if (config.apiKey && config.model && config.modelEndpoint) {
      initLLMBridge(config.model, config.apiKey, config.modelEndpoint, config.modelName)

      // v2: Initialize sub-agent manager with tool executor
      const subAgentManager = initSubAgentManager({
        maxConcurrentAgents: config.subAgent?.maxConcurrentAgents || 4,
        maxKVCacheSize: config.subAgent?.maxKVCacheSize || 128000,
        onAgentComplete: (result: SubAgentResult) => {
          console.log('[SubAgent] Agent completed:', result.agentId, result.success)
          setSubAgentStatus(`Sub-agent completed: ${result.success ? 'success' : 'failed'}`)
        }
      })

      // v2: Initialize multi-agent engine for collaboration
      initMultiAgentEngine({
        maxConcurrentAgents: config.subAgent?.maxConcurrentAgents || 4,
        maxKVCacheSize: config.subAgent?.maxKVCacheSize || 128000
      })

      // Set tool executor callback
      const electronAPI = (window as any).electronAPI
      if (electronAPI?.tool) {
        subAgentManager.setToolExecutor(async (toolName: string, args: Record<string, unknown>): Promise<ToolResult> => {
          const riskLevel =
            toolName === 'bash_execute' ? 'high' :
            ['file_write', 'file_append', 'edit_code'].includes(toolName) ? 'medium' : 'low'

          const response = await electronAPI.tool.execute({ name: toolName, arguments: args, riskLevel })

          return {
            toolName,
            arguments: args,
            result: response.result,
            success: response.success,
            error: response.error,
            timestamp: Date.now()
          }
        })
      }
    }
  }, [config.apiKey, config.model, config.modelEndpoint, config.modelName])

  // v2: Get tools - use V2_TOOLS instead of MVP_TOOLS
  const getTools = useCallback(() => {
    // Check if sub-agent mode is enabled
    if (config.subAgent?.enabled) {
      return V2_TOOLS
    }
    return V2_TOOLS // v2 always uses extended tools
  }, [config.subAgent])

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
      ['file_write', 'file_append', 'edit_code'].includes(toolName) ? 'medium' : 'low'

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
    updatePlanStep(step.id, { status: 'executing', verificationStatus: 'pending' })

    const result = await executeTool(step.toolName, step.arguments)

    // v2: Run verification using enhanced background classifier
    const verification = getVerificationHooks()
    const verificationResult = verification.verify(result)
    const verificationConfig = verification.getConfig()

    // Determine verification status
    let verificationStatus: 'passed' | 'warning' | 'failed' = 'passed'
    if (!verificationResult.passed) {
      verificationStatus = 'failed'
    } else if (verificationResult.warnings.length > 0) {
      verificationStatus = 'warning'
    }

    const verificationMessage = verification.formatVerificationMessage(verificationResult)

    updatePlanStep(step.id, {
      status: result.success ? 'completed' : 'failed',
      result: result.result,
      error: result.error,
      verificationStatus,
      verificationMessage,
      warnings: verificationResult.warnings
    })

    if (!verificationResult.passed || verificationResult.warnings.length > 0) {
      const msg = verification.formatVerificationMessage(verificationResult)
      if (msg) {
        addWarning({
          toolName: step.toolName,
          message: msg,
          severity: verificationResult.passed ? 'warning' : 'error'
        })
      }

      // v2: Handle auto-retry if verification recommends it
      if (verificationResult.retryRecommended && verificationConfig.autoRetry) {
        console.log('[Verification] Retrying failed step:', step.id)
        updatePlanStep(step.id, { status: 'executing' }) // Show retrying state
        const retryResult = await executeTool(step.toolName, step.arguments)

        // Re-verify after retry
        const retryVerification = verification.verify(retryResult)
        let retryVerificationStatus: 'passed' | 'warning' | 'failed' = 'passed'
        if (!retryVerification.passed) {
          retryVerificationStatus = 'failed'
        } else if (retryVerification.warnings.length > 0) {
          retryVerificationStatus = 'warning'
        }

        // Update with retry result
        updatePlanStep(step.id, {
          result: retryResult.result,
          error: retryResult.error,
          status: retryResult.success ? 'completed' : 'failed',
          verificationStatus: retryVerificationStatus,
          verificationMessage: verification.formatVerificationMessage(retryVerification),
          warnings: retryVerification.warnings
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
    const verification = getVerificationHooks()

    // Execute tool calls in sequence for now (can be parallelized)
    for (const tc of toolCalls) {
      const result = await executeTool(tc.name, tc.arguments)
      results.push(result)
      contextManager.addToolCall(tc.name, tc.arguments, result)

      // Update message with tool results
      updateMessage(assistantMessageId, {
        toolResults: [...(messages.find(m => m.id === assistantMessageId)?.toolResults || []), result]
      })

      // v2: Enhanced verification - background classifier only checks results
      const verification = getVerificationHooks()
      const verificationResult = verification.verify(result)
      const verificationConfig = verification.getConfig()

      if (!verificationResult.passed || verificationResult.warnings.length > 0) {
        const msg = verification.formatVerificationMessage(verificationResult)
        if (msg) {
          addWarning({
            toolName: tc.name,
            message: msg,
            severity: verificationResult.passed ? 'warning' : 'error'
          })
        }

        // v2: Auto-retry on failure if configured
        if (verificationResult.retryRecommended && verificationConfig.autoRetry) {
          console.log('[Verification] Auto-retrying tool:', tc.name)
          let retries = 0
          let retryResult = result

          while (retries < (verificationConfig.maxRetries || 3) && !retryResult.success) {
            retries++
            retryResult = await executeTool(tc.name, tc.arguments)

            // Update with retry result
            updateMessage(assistantMessageId, {
              toolResults: [...(messages.find(m => m.id === assistantMessageId)?.toolResults || []), retryResult]
            })
          }
        }
      }
    }

    // Build result summary
    const summaryParts = results.map(r =>
      `${r.toolName}: ${r.success ? '✓' : '✗'}`
    )

    return summaryParts.join(', ')
  }, [executeTool, updateMessage, messages, addWarning])

  // v2: Handle user input with sub-agent support
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

    // v2: Check if task should be handled by sub-agent
    const shouldUseSubAgent = config.subAgent?.enabled && await shouldDelegateToSubAgent(input)

    if (shouldUseSubAgent) {
      setSubAgentStatus('Delegating to sub-agent...')
      await handleSubAgentExecution(input, bridge, chatMessages, systemPrompt)
      setLoading(false)
      return
    }

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
    const compressionResult = contextManager.compress()
    if (compressionResult) {
      console.log(`Context compressed (${compressionResult.level}): ${compressionResult.originalCount} → ${compressionResult.compressedCount} pointers, ${Math.round(compressionResult.savedRatio * 100)}% tokens saved`)
    }

    setLoading(false)
  }, [config, addMessage, updateMessage, setLoading, setMode, setPlan, clearWarnings, processToolCalls])

  // v2: Determine if a task should be delegated to a sub-agent
  const shouldDelegateToSubAgent = async (input: string): Promise<boolean> => {
    const lowerInput = input.toLowerCase()

    // Heuristics for sub-agent delegation:
    // 1. Complex multi-step tasks
    // 2. Tasks that can be parallelized
    // 3. Tasks involving multiple files
    const complexIndicators = [
      'refactor', 'restructure', 'rebuild', 'migrate', 'implement multiple',
      'create a project', 'build a system', 'setup multiple', 'analyze and fix'
    ]

    const hasComplexIndicator = complexIndicators.some(indicator =>
      lowerInput.includes(indicator)
    )

    if (hasComplexIndicator) return true

    // Check for parallelizable subtasks
    const parallelIndicators = ['and then', 'after that', 'followed by', 'finally']
    const hasParallel = parallelIndicators.some(p => lowerInput.includes(p))

    return hasParallel && lowerInput.length > 200
  }

  // v2: Handle sub-agent execution
  const handleSubAgentExecution = async (
    input: string,
    bridge: LLMBridge,
    chatMessages: ChatMessage[],
    systemPrompt: string
  ) => {
    const subAgentManager = getSubAgentManager()
    const multiAgentEngine = getMultiAgentEngine()

    // Create a sub-agent for this task
    const agent = subAgentManager.createAgent('task-' + Date.now())

    // Set collaboration active with this agent
    setCollaborationActive(true, [agent])

    // Share KV cache from parent context
    const contextManager = getContextManager()
    const memory = contextManager.getMemory()
    subAgentManager.updateKVCache(agent.id, memory)

    // Use the task_plan tool to decompose the task
    try {
      const planResult = await executeTool('task_plan', {
        task_description: input,
        max_subtasks: config.subAgent?.maxSubtasks || 5,
        include_dependencies: true
      })

      if (planResult.success && planResult.result) {
        const planData = planResult.result as { tasks?: Array<{ id: string; description: string; toolCalls: any[]; dependencies: string[] }> }

        if (planData.tasks && planData.tasks.length > 0) {
          // Add tasks to sub-agent
          for (const task of planData.tasks) {
            subAgentManager.addTask(
              agent.id,
              task.description,
              task.toolCalls.map((tc: any) => ({ name: tc.name, arguments: tc.arguments || {} })),
              task.dependencies || []
            )
          }

          setSubAgentStatus('Sub-agent analyzing task decomposition...')

          // Run the sub-agent
          const result = await subAgentManager.runAgent(agent.id)

          // Aggregate results
          addMessage({
            role: 'assistant',
            content: `Sub-agent completed: ${result.aggregatedOutput || 'Task executed successfully'}`
          })

          // Merge sub-agent KV cache back to parent
          if (result.kvCacheSnapshot) {
            contextManager.mergePointers?.(result.kvCacheSnapshot.pointers)
          }

          return
        }
      }
    } catch (error: any) {
      console.error('[SubAgent] Error:', error)
    }

    // Fallback: run as normal task
    addMessage({
      role: 'assistant',
      content: 'Sub-agent analysis complete. Executing task directly...'
    })

    // Continue with normal execution
    setMode('execution')
  }

  // Confirm plan execution
  const handlePlanConfirm = useCallback(async () => {
    if (!currentPlan) return

    setShowPlan(false)
    setLoading(true)
    setIsPlanExecuting(true)

    // Mark plan as confirmed
    setPlan({ ...currentPlan, confirmed: true })

    // Update mode to execution
    setMode('execution')

    // Execute the plan
    const results = await executePlan(currentPlan)

    setIsPlanExecuting(false)

    // Build summary message with verification stats
    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    // Calculate verification stats from current plan
    const verificationStats = {
      passed: (currentPlan?.steps || []).filter(s => s.verificationStatus === 'passed').length,
      warnings: (currentPlan?.steps || []).filter(s => s.verificationStatus === 'warning').length,
      failed: (currentPlan?.steps || []).filter(s => s.verificationStatus === 'failed').length
    }

    addMessage({
      role: 'assistant',
      content: `Plan executed.\n\n✅ ${succeeded} step(s) completed successfully${failed > 0 ? `\n❌ ${failed} step(s) failed` : ''}${verificationStats.passed > 0 ? `\n📋 Verification: ${verificationStats.passed} passed${verificationStats.warnings > 0 ? ` | ${verificationStats.warnings} warnings` : ''}${verificationStats.failed > 0 ? ` | ${verificationStats.failed} failed` : ''}` : ''}`,
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

  // Abort plan execution
  const handlePlanAbort = useCallback(() => {
    setIsPlanExecuting(false)
    setLoading(false)
    // Mark remaining pending steps as skipped
    if (currentPlan) {
      currentPlan.steps.forEach(step => {
        if (step.status === 'pending' || step.status === 'executing') {
          // Note: This won't directly update since we don't have direct mutation
          // But the UI state will clear on next action
        }
      })
    }
    setShowPlan(false)
    setPlan(null)
    setMode('execution')
    addMessage({
      role: 'assistant',
      content: 'Plan execution aborted. Some steps may not have completed.'
    })
  }, [currentPlan, setPlan, setMode, addMessage, setLoading])

  // Ctrl+Shift+L to toggle log viewer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        setShowLogViewer(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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
                      onAbort={handlePlanAbort}
                      isExecuting={isPlanExecuting}
                    />
                  )}
                  {/* v2: Show sub-agent status */}
                  {subAgentStatus && (
                    <div className="sub-agent-status">{subAgentStatus}</div>
                  )}
                  {/* v2: Show collaboration view */}
                  {showCollaboration && isCollaborationActive && (
                    <CollaborationView
                      agents={agentsToCollaborationView(activeAgents)}
                      activeTasks={getActiveTasks(activeAgents)}
                      onAgentSelect={(agentId) => console.log('Selected agent:', agentId)}
                      onTaskSelect={(taskId) => console.log('Selected task:', taskId)}
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

      {showLogViewer && <LogViewer onClose={() => setShowLogViewer(false)} />}
    </div>
  )
}

export default App
