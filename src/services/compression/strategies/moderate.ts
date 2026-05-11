import type { MemoryPointer } from '../../../types'
import type { CompressionStrategy, CompressionResult } from '../types'

/**
 * Moderate Compression Strategy (Level 2)
 * 
 * - Deletes oldest user_input summaries
 * - Merges consecutive assistant_response messages
 * - Target: 50% pointer reduction
 */
export class ModerateCompressionStrategy implements CompressionStrategy {
  level: 'moderate' = 'moderate'

  constructor(private keepRecentCount = 20) {}

  shouldCompress(currentTokens: number, maxTokens: number): boolean {
    return currentTokens >= maxTokens * 0.85
  }

  compress(pointers: MemoryPointer[], maxTokens: number): CompressionResult {
    const originalCount = pointers.length
    const originalTokens = this.estimateTokens(pointers)

    // Sort by timestamp (oldest first)
    const sorted = [...pointers].sort((a, b) => a.timestamp - b.timestamp)

    // Keep recent N pointers intact
    const recentCount = Math.min(this.keepRecentCount, Math.floor(sorted.length / 2))
    const recent = sorted.slice(-recentCount)
    const toProcess = sorted.slice(0, -recentCount)

    // Process older pointers
    const processed: MemoryPointer[] = []

    // Separate by type for different processing
    const userInputs = toProcess.filter(p => p.type === 'user_input')
    const assistantResponses = toProcess.filter(p => p.type === 'assistant_response')
    const toolCalls = toProcess.filter(p => p.type === 'tool_call')
    const toolResults = toProcess.filter(p => p.type === 'tool_result')

    // 1. Delete oldest user_input summaries (keep only latest 3)
    const keepUserInputs = userInputs.slice(-3)
    const deletedUserInputs = userInputs.length - keepUserInputs.length

    // 2. Merge consecutive assistant_responses
    const mergedAssistantResponses = this.mergeConsecutiveResponses(assistantResponses)

    // 3. Keep tool_calls and tool_results as-is (they're important)
    processed.push(...keepUserInputs)
    processed.push(...mergedAssistantResponses)
    processed.push(...toolCalls)
    processed.push(...toolResults)

    // Combine with recent pointers
    const compressed: MemoryPointer[] = [
      ...processed,
      ...recent
    ]

    // Sort by timestamp
    compressed.sort((a, b) => a.timestamp - b.timestamp)

    const compressedTokens = this.estimateTokens(compressed)

    return {
      level: this.level,
      originalCount,
      compressedCount: compressed.length,
      originalTokens,
      compressedTokens,
      savedTokens: originalTokens - compressedTokens,
      savedRatio: (originalTokens - compressedTokens) / originalTokens,
      summary: `Moderate: deleted ${deletedUserInputs} user_inputs, merged ${assistantResponses.length - mergedAssistantResponses.length} assistant responses`,
      compressedPointers: compressed
    }
  }

  /**
   * Merge consecutive assistant responses into summary entries
   */
  private mergeConsecutiveResponses(responses: MemoryPointer[]): MemoryPointer[] {
    if (responses.length <= 1) return responses

    const merged: MemoryPointer[] = []
    let currentGroup: MemoryPointer[] = []
    let lastTimestamp = 0

    for (const response of responses) {
      // If responses are within 30 seconds of each other, group them
      if (currentGroup.length > 0 && response.timestamp - lastTimestamp < 30000) {
        currentGroup.push(response)
      } else {
        // Flush current group
        if (currentGroup.length > 0) {
          merged.push(this.createMergedResponse(currentGroup))
        }
        currentGroup = [response]
      }
      lastTimestamp = response.timestamp
    }

    // Flush last group
    if (currentGroup.length > 0) {
      merged.push(this.createMergedResponse(currentGroup))
    }

    return merged
  }

  private createMergedResponse(group: MemoryPointer[]): MemoryPointer {
    const now = Date.now()
    const summaries = group.map(p => p.summary).join(' | ')

    return {
      id: `merged-assistant-${now}`,
      type: 'assistant_response',
      summary: `[${group.length} consecutive responses] ${group[0].summary.slice(0, 50)}...`,
      fullContent: `Merged ${group.length} consecutive assistant responses:\n${group.map(p => p.fullContent).join('\n---\n')}`,
      timestamp: group[group.length - 1].timestamp,
      associations: group.flatMap(p => p.associations)
    }
  }

  private estimateTokens(pointers: MemoryPointer[]): number {
    return pointers.reduce((sum, p) => sum + Math.ceil(p.fullContent.length / 4), 0)
  }
}
