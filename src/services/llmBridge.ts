import { V2_TOOLS } from './modelAdapters'
import type { ChatMessage, ToolDefinition, ExecutionPlan, PlanStep } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { getToolRegistry } from './tools'
import { providerManager } from './providers'
import { OpenAIProvider } from './providers/openaiProvider'

// Renderer-side logger: forwards to electron-log via IPC
function rendererLog(level: 'info' | 'warn' | 'error', module: string, message: string, data?: Record<string, unknown>) {
  const payload = data ? `${message} ${JSON.stringify(data)}` : message
  if (level === 'error') {
    console.error(`[${module}]`, payload)
  } else if (level === 'warn') {
    console.warn(`[${module}]`, payload)
  } else {
    console.log(`[${module}]`, payload)
  }
  // Bridge to electron-log buffer via IPC if available
  const electronAPI = (window as any).electronAPI
  if (electronAPI?.log?.append) {
    electronAPI.log.append({ level, module, message: payload }).catch(() => {})
  }
}

interface LLMStreamCallbacks {
  onChunk: (chunk: string) => void
  onComplete: () => void
  onError: (error: Error) => void
  onToolCalls?: (toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>) => void
}

export class LLMBridge {
  private systemPrompt: string = ''

  constructor(_provider: string, _apiKey: string, _endpoint: string, _modelName: string) {
    // Provider is registered externally via initLLMBridge
    rendererLog('info', 'LLMBridge', 'LLMBridge constructed', { _provider, _endpoint, _modelName })
  }

  setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt
  }

  private getTools(): ToolDefinition[] {
    try {
      const registry = getToolRegistry()
      const availableTools = registry.getAvailableTools()
      if (availableTools.length > 0) {
        return availableTools
      }
    } catch {
      // ToolRegistry not initialized yet, use V2_TOOLS
    }
    return V2_TOOLS
  }

  async chat(messages: ChatMessage[], streamCallbacks?: LLMStreamCallbacks): Promise<{
    content: string
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
  }> {
    if (streamCallbacks) {
      return this.streamChat(messages, streamCallbacks)
    }

    rendererLog('info', 'LLMBridge', 'chat() called — non-streaming', { messageCount: messages.length })

    const tools = this.getTools()
    const provider = providerManager.getCurrentProvider()

    if (!provider) {
      const err = 'No active LLM provider configured. Please set up a provider first.'
      rendererLog('error', 'LLMBridge', err)
      throw new Error(err)
    }

    rendererLog('info', 'LLMBridge', 'Calling provider.chat()', {
      provider: provider.name,
      toolCount: tools.length
    })

    const start = Date.now()
    try {
      const response = await provider.chat(messages)
      rendererLog('info', 'LLMBridge', `provider.chat() done in ${Date.now() - start}ms`, {
        contentLength: response.content.length,
        hasError: !!response.error,
        finishReason: response.finishReason
      })

      if (response.error) {
        rendererLog('error', 'LLMBridge', 'Provider returned error', { error: response.error })
      }

      return {
        content: response.content,
        toolCalls: (response as any).toolCalls || []
      }
    } catch (err: any) {
      rendererLog('error', 'LLMBridge', 'provider.chat() threw', { error: err.message })
      throw err
    }
  }

  private async streamChat(
    messages: ChatMessage[],
    callbacks: LLMStreamCallbacks
  ): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> }> {
    let fullContent = ''
    const tools = this.getTools()

    rendererLog('info', 'LLMBridge', 'streamChat() called', { messageCount: messages.length })

    return new Promise((resolve) => {
      const provider = providerManager.getCurrentProvider()

      if (!provider) {
        const errMsg = 'No active LLM provider configured. Please set up a provider first.'
        rendererLog('error', 'LLMBridge', errMsg)
        callbacks.onError(new Error(errMsg))
        resolve({ content: fullContent, toolCalls: [] })
        return
      }

      rendererLog('info', 'LLMBridge', 'Calling provider.stream()', { provider: provider.name })
      const start = Date.now()

      provider.stream({
        messages,
        systemPrompt: this.systemPrompt,
        tools,
        onChunk: (chunk: string) => {
          fullContent += chunk
          callbacks.onChunk(chunk)
        },
        onComplete: () => {
          rendererLog('info', 'LLMBridge', `stream complete in ${Date.now() - start}ms`, {
            totalLength: fullContent.length
          })
          callbacks.onComplete()
          resolve({
            content: fullContent,
            toolCalls: []
          })
        },
        onError: (error: Error) => {
          rendererLog('error', 'LLMBridge', 'stream error', { error: error.message })
          callbacks.onError(error)
          resolve({
            content: fullContent,
            toolCalls: []
          })
        }
      })
    })
  }

  // Determine if a task requires planning mode
  async shouldUsePlanningMode(messages: ChatMessage[]): Promise<boolean> {
    const lastMessage = messages[messages.length - 1]?.content || ''

    const planningKeywords = ['refactor', 'restructure', 'rebuild', 'migrate', 'implement', 'create a', 'build a', 'set up a', '重构', '重塑', '重建', '迁移']
    const isLongTask = lastMessage.length > 500

    const hasPlanningKeyword = planningKeywords.some(kw =>
      lastMessage.toLowerCase().includes(kw)
    )

    return hasPlanningKeyword || isLongTask
  }

  // Generate execution plan from messages
  async generatePlan(messages: ChatMessage[]): Promise<ExecutionPlan> {
    const planPrompt = `${this.systemPrompt}

## Task: Generate Execution Plan
Based on the user's request, generate a detailed execution plan.

User request: ${messages[messages.length - 1]?.content}

Respond with a JSON object in this format:
{
  "taskDescription": "Brief description of the task",
  "steps": [
    {
      "description": "Step description",
      "toolName": "tool_name",
      "arguments": { "arg1": "value1" },
      "riskLevel": "low|medium|high"
    }
  ],
  "risks": ["risk1", "risk2"],
  "totalSteps": number
}

Only use the following tools: file_read, file_write, file_append, dir_list, bash_execute, grep_search, glob
Do not include tool_status in the plan.
`

    const provider = providerManager.getCurrentProvider()

    if (!provider) {
      throw new Error('No active LLM provider configured. Please set up a provider first.')
    }

    const response = await provider.chat([
      ...messages.slice(0, -1),
      { role: 'user' as const, content: planPrompt }
    ])

    try {
      const planData = JSON.parse(response.content)

      const steps: PlanStep[] = (planData.steps || []).map((s: any, idx: number) => ({
        id: uuidv4(),
        description: s.description,
        toolName: s.toolName,
        arguments: s.arguments || {},
        riskLevel: s.riskLevel || 'low',
        status: 'pending' as const,
        order: idx
      }))

      return {
        taskDescription: planData.taskDescription || planData.description || 'Task',
        steps,
        risks: planData.risks || [],
        totalSteps: steps.length,
        confirmed: false
      }
    } catch {
      return {
        taskDescription: 'User request',
        steps: [{
          id: uuidv4(),
          description: response.content.slice(0, 200),
          toolName: 'bash_execute',
          arguments: { command: 'echo "Manual intervention needed"' },
          riskLevel: 'low',
          status: 'pending',
          order: 0
        }],
        risks: ['Could not auto-generate plan'],
        totalSteps: 1,
        confirmed: false
      }
    }
  }
}

// Singleton instance
let bridgeInstance: LLMBridge | null = null

export function getLLMBridge(): LLMBridge | null {
  return bridgeInstance
}

export function initLLMBridge(provider: string, apiKey: string, endpoint: string, modelName: string): LLMBridge {
  rendererLog('info', 'LLMBridge', 'initLLMBridge()', { provider, endpoint, modelName })

  // Create OpenAI provider and register with providerManager
  const openaiProvider = new OpenAIProvider({
    name: 'openai',
    baseUrl: endpoint || 'https://api.openai.com/v1',
    apiKey,
    model: modelName || 'gpt-4o'
  })

  providerManager.register(openaiProvider)
  rendererLog('info', 'LLMBridge', 'Provider registered', {
    name: openaiProvider.name,
    baseUrl: openaiProvider.config.baseUrl,
    model: openaiProvider.config.model
  })

  bridgeInstance = new LLMBridge(provider, apiKey, endpoint, modelName)
  return bridgeInstance
}
