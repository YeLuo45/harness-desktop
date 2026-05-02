import { createModelAdapter, V2_TOOLS, type ModelAdapter } from './modelAdapters'
import type { ChatMessage, ToolCall, ToolDefinition, ToolResult, ExecutionPlan, PlanStep } from '../types'
import { v4 as uuidv4 } from 'uuid'

interface LLMStreamCallbacks {
  onChunk: (chunk: string) => void
  onComplete: () => void
  onError: (error: Error) => void
  onToolCalls?: (toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>) => void
}

export class LLMBridge {
  private adapter: ModelAdapter
  private systemPrompt: string = ''

  constructor(provider: string, apiKey: string, endpoint: string, modelName: string) {
    this.adapter = createModelAdapter(
      provider as any,
      apiKey,
      endpoint,
      modelName
    )
  }

  setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt
  }

  async chat(messages: ChatMessage[], streamCallbacks?: LLMStreamCallbacks): Promise<{
    content: string
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
  }> {
    if (streamCallbacks) {
      return this.streamChat(messages, streamCallbacks)
    }

    const response = await this.adapter.chat(messages, this.systemPrompt, V2_TOOLS)
    return {
      content: response.content,
      toolCalls: response.toolCalls || []
    }
  }

  private async streamChat(
    messages: ChatMessage[],
    callbacks: LLMStreamCallbacks
  ): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> }> {
    let fullContent = ''

    return new Promise((resolve) => {
      this.adapter.stream({
        messages,
        systemPrompt: this.systemPrompt,
        tools: V2_TOOLS,
        onChunk: (chunk) => {
          fullContent += chunk
          callbacks.onChunk(chunk)
        },
        onComplete: () => {
          callbacks.onComplete()
          // For streaming, we parse tool calls from the full content if available
          // In practice, the API will send tool calls in a separate format
          resolve({
            content: fullContent,
            toolCalls: []
          })
        },
        onError: (error) => {
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

    // Heuristics for planning mode:
    // 1. Message contains planning keywords
    // 2. Message is long and complex
    const planningKeywords = ['refactor', 'restructure', 'rebuild', 'migrate', 'implement', 'create a', 'build a', 'set up a']
    const isLongTask = lastMessage.length > 500

    const hasPlanningKeyword = planningKeywords.some(kw =>
      lastMessage.toLowerCase().includes(kw)
    )

    return hasPlanningKeyword || isLongTask
  }

  // Generate execution plan from messages
  async generatePlan(messages: ChatMessage[]): Promise<ExecutionPlan> {
    // Create a plan generation prompt
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

    const response = await this.adapter.chat(
      [...messages.slice(0, -1), { role: 'user' as const, content: planPrompt }],
      ''
    )

    try {
      // Try to parse the response as JSON
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
      // If parsing fails, create a simple plan
      return {
        taskDescription: 'User request',
        steps: [{
          id: uuidv4(),
          description: response.content.slice(0, 200),
          toolName: 'bash_execute',
          arguments: { command: 'echo "Manual intervention needed"' },
          riskLevel: 'low',
          status: 'pending'
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
  bridgeInstance = new LLMBridge(provider, apiKey, endpoint, modelName)
  return bridgeInstance
}
