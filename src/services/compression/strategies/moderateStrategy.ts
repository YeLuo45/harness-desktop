import type { MemoryPointer } from '../../../types'
import type { CompressionStrategy, CompressionResult } from '../types'

/**
 * Moderate compression - summarize older messages, keep recent ones
 * Triggered at 85% capacity
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

    // Sort by timestamp (oldest first for summarization)
    const sorted = [...pointers].sort((a, b) => a.timestamp - b.timestamp)

    // Keep recent N intact
    const recentCount = Math.min(this.keepRecentCount, Math.floor(sorted.length / 2))
    const recent = sorted.slice(-recentCount)
    const toSummarize = sorted.slice(0, -recentCount)

    // Generate summaries grouped by type
    const summaries = this.summarizeByType(toSummarize)

    // Combine: summaries first, then recent
    const compressed: MemoryPointer[] = [
      ...summaries,
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
      summary: `Summarized ${toSummarize.length} messages into ${summaries.length} summary entries`,
      compressedPointers: compressed
    }
  }

  private summarizeByType(pointers: MemoryPointer[]): MemoryPointer[] {
    const byType = new Map<MemoryPointer['type'], MemoryPointer[]>()

    for (const ptr of pointers) {
      if (!byType.has(ptr.type)) {
        byType.set(ptr.type, [])
      }
      byType.get(ptr.type)!.push(ptr)
    }

    const summaries: MemoryPointer[] = []
    const now = Date.now()

    for (const [type, group] of byType) {
      if (group.length === 0) continue

      // Create one summary entry per type group
      const summaries_text = group.map(p => p.summary).join(' | ')

      summaries.push({
        id: `summary-${type}-${now}`,
        type,
        summary: `[${group.length} ${type} messages summarized]`,
        fullContent: `Summary of ${group.length} ${type} messages:\n${summaries_text}`,
        timestamp: group[group.length - 1].timestamp,
        associations: []
      })
    }

    return summaries
  }

  private estimateTokens(pointers: MemoryPointer[]): number {
    return pointers.reduce((sum, p) => sum + Math.ceil(p.fullContent.length / 4), 0)
  }
}
