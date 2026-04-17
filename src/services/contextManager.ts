import { v4 as uuidv4 } from 'uuid'
import type { MemoryPointer, ChatMessage, ToolResult } from '../types'

const MAX_CONTEXT_TOKENS = 128000
const COMPRESSION_THRESHOLD = 0.8 // 80% of max
const AVERAGE_TOKEN_SIZE = 4 // rough estimate for English

export class ContextManager {
  private memory: MemoryPointer[] = []
  private tokenCount: number = 0

  // Add a user input to memory
  addUserInput(content: string): string {
    const pointerId = uuidv4()
    const summary = this.generateSummary(content, 'user_input')

    this.memory.push({
      id: pointerId,
      type: 'user_input',
      summary,
      fullContent: content,
      timestamp: Date.now(),
      associations: []
    })

    this.updateTokenCount()
    return pointerId
  }

  // Add an assistant response to memory
  addAssistantResponse(content: string, relatedPointers: string[] = []): string {
    const pointerId = uuidv4()
    const summary = this.generateSummary(content, 'assistant_response')

    this.memory.push({
      id: pointerId,
      type: 'assistant_response',
      summary,
      fullContent: content,
      timestamp: Date.now(),
      associations: relatedPointers
    })

    this.updateTokenCount()
    return pointerId
  }

  // Add a tool call to memory
  addToolCall(toolName: string, arguments_: Record<string, unknown>, result: ToolResult): string {
    const pointerId = uuidv4()
    const content = `Tool: ${toolName}\nArgs: ${JSON.stringify(arguments_)}\nResult: ${JSON.stringify(result)}`
    const summary = `${toolName}(${Object.keys(arguments_).join(', ')})`

    this.memory.push({
      id: pointerId,
      type: 'tool_call',
      summary,
      fullContent: content,
      timestamp: Date.now(),
      associations: []
    })

    this.updateTokenCount()
    return pointerId
  }

  // Build messages for LLM from current context
  buildMessages(
    systemPrompt: string,
    currentInput: string,
    maxHistoryMessages = 20
  ): ChatMessage[] {
    const messages: ChatMessage[] = []

    // Add recent tool results and assistant responses as conversation history
    const recentMemory = this.memory.slice(-maxHistoryMessages)

    for (const pointer of recentMemory) {
      switch (pointer.type) {
        case 'user_input':
          messages.push({
            role: 'user',
            content: pointer.fullContent
          })
          break
        case 'assistant_response':
          messages.push({
            role: 'assistant',
            content: pointer.fullContent
          })
          break
        case 'tool_call':
          // Tool calls are represented differently
          // We include them as context but not as separate messages
          break
      }
    }

    // Add current input
    messages.push({
      role: 'user',
      content: currentInput
    })

    return messages
  }

  // Check if context needs compression
  needsCompression(): boolean {
    return this.tokenCount >= MAX_CONTEXT_TOKENS * COMPRESSION_THRESHOLD
  }

  // Compress context by keeping important pointers and summarizing others
  compress(): { compressedCount: number; remainingCount: number } {
    const beforeCount = this.memory.length

    // Strategy: Keep the most recent pointers and pointers with associations
    // Compress older, standalone pointers
    const recent = this.memory.filter((p) => {
      // Keep if in last 50% of memory
      const index = this.memory.indexOf(p)
      return index > this.memory.length * 0.5
    })

    const withAssociations = this.memory.filter(
      (p) => p.associations.length > 0 && !recent.includes(p)
    )

    // Keep system prompts and tool statuses
    const important = this.memory.filter(
      (p) => p.type === 'tool_call' && p.summary.includes('tool_status')
    )

    this.memory = [...recent, ...withAssociations, ...important]
    this.updateTokenCount()

    const afterCount = this.memory.length

    return {
      compressedCount: beforeCount - afterCount,
      remainingCount: afterCount
    }
  }

  // Merge similar pointers
  mergeSimilar(): number {
    const merged: Map<string, MemoryPointer[]> = new Map()

    // Group by type and summary prefix
    for (const pointer of this.memory) {
      const key = `${pointer.type}:${pointer.summary.slice(0, 50)}`
      if (!merged.has(key)) {
        merged.set(key, [])
      }
      merged.get(key)!.push(pointer)
    }

    let mergeCount = 0

    for (const [_, group] of merged) {
      if (group.length > 1) {
        // Keep the most recent, remove others
        const keep = group.pop()!
        mergeCount += group.length
        this.memory = this.memory.filter((p) => !group.includes(p))

        // Update associations
        if (keep.associations.length === 0) {
          keep.associations = group.map((p) => p.id)
        }
      }
    }

    this.updateTokenCount()
    return mergeCount
  }

  // Get all memory pointers
  getMemory(): MemoryPointer[] {
    return this.memory
  }

  // Get memory by ID
  getMemoryById(id: string): MemoryPointer | undefined {
    return this.memory.find((p) => p.id === id)
  }

  // Get current token count
  getTokenCount(): number {
    return this.tokenCount
  }

  // Clear all memory
  clear(): void {
    this.memory = []
    this.tokenCount = 0
  }

  // Private helpers
  private generateSummary(content: string, type: MemoryPointer['type']): string {
    // Generate a brief summary based on type
    if (type === 'user_input') {
      return content.slice(0, 100) + (content.length > 100 ? '...' : '')
    }
    if (type === 'assistant_response') {
      return content.slice(0, 150) + (content.length > 150 ? '...' : '')
    }
    return content.slice(0, 100)
  }

  private updateTokenCount(): void {
    let total = 0
    for (const pointer of this.memory) {
      total += pointer.fullContent.length
    }
    this.tokenCount = Math.ceil(total / AVERAGE_TOKEN_SIZE)
  }
}

// Singleton
let contextManagerInstance: ContextManager | null = null

export function getContextManager(): ContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new ContextManager()
  }
  return contextManagerInstance
}

export function initContextManager(): ContextManager {
  contextManagerInstance = new ContextManager()
  return contextManagerInstance
}
