import type { MemoryPointer } from '../../../types'
import type { CompressionStrategy, CompressionResult } from '../types'

/**
 * Aggressive compression - LLM-driven comprehensive summarization
 * Triggered at 95% capacity
 * Keeps only critical state, summarizes everything else
 */
export class AggressiveCompressionStrategy implements CompressionStrategy {
  level: 'aggressive' = 'aggressive'

  constructor(
    private keepCriticalCount = 5,
    private summaryMaxTokens = 500
  ) {}

  shouldCompress(currentTokens: number, maxTokens: number): boolean {
    return currentTokens >= maxTokens * 0.95
  }

  compress(pointers: MemoryPointer[], maxTokens: number): CompressionResult {
    const originalCount = pointers.length
    const originalTokens = this.estimateTokens(pointers)

    // Sort by timestamp
    const sorted = [...pointers].sort((a, b) => b.timestamp - a.timestamp) // newest first

    // Separate critical vs compressible
    const critical = this.extractCriticalPointers(sorted)
    const compressible = sorted.filter(p => !critical.includes(p))

    // Generate comprehensive summary
    const summaryPointer = this.generateComprehensiveSummary(compressible)

    // Final: critical pointers + summary
    const compressed: MemoryPointer[] = [
      ...critical,
      summaryPointer
    ]

    const compressedTokens = this.estimateTokens(compressed)

    return {
      level: this.level,
      originalCount,
      compressedCount: compressed.length,
      originalTokens,
      compressedTokens,
      savedTokens: originalTokens - compressedTokens,
      savedRatio: (originalTokens - compressedTokens) / originalTokens,
      summary: `Aggressive compression: ${originalCount} messages → ${compressed.length} entries (${Math.round((1-compressedTokens/originalTokens)*100)}% reduction)`,
      compressedPointers: compressed
    }
  }

  /**
   * Extract critical pointers that should never be compressed
   */
  private extractCriticalPointers(pointers: MemoryPointer[]): MemoryPointer[] {
    const critical: MemoryPointer[] = []

    // 1. Most recent N pointers
    const recent = pointers.slice(0, this.keepCriticalCount)
    critical.push(...recent)

    // 2. Pointers with associations (related to other important content)
    const withAssociations = pointers.filter(p => p.associations.length > 0)
    for (const p of withAssociations) {
      if (!critical.some(c => c.id === p.id)) {
        critical.push(p)
      }
    }

    // 3. Tool calls (generally important for context)
    const toolCalls = pointers.filter(p => p.type === 'tool_call')
    for (const p of toolCalls) {
      if (!critical.some(c => c.id === p.id)) {
        critical.push(p)
      }
    }

    // Deduplicate by id
    const seen = new Set<string>()
    return critical.filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
  }

  /**
   * Generate a comprehensive summary of compressible content
   */
  private generateComprehensiveSummary(pointers: MemoryPointer[]): MemoryPointer {
    const now = Date.now()

    // Group by type for structured summary
    const byType = new Map<MemoryPointer['type'], { summaries: string[]; count: number }>()

    for (const ptr of pointers) {
      if (!byType.has(ptr.type)) {
        byType.set(ptr.type, { summaries: [], count: 0 })
      }
      const entry = byType.get(ptr.type)!
      entry.summaries.push(ptr.summary)
      entry.count++
    }

    // Build structured summary content
    const lines: string[] = ['[COMPREHENSIVE CONVERSATION SUMMARY]']

    for (const [type, data] of byType) {
      lines.push(`\n## ${type.toUpperCase()} (${data.count} messages)`)
      lines.push('Key topics:')
      // Take unique summaries (up to 5 per type)
      const unique = [...new Set(data.summaries)].slice(0, 5)
      for (const s of unique) {
        lines.push(`- ${s}`)
      }
      if (data.count > 5) {
        lines.push(`- ... and ${data.count - 5} more ${type} messages`)
      }
    }

    return {
      id: `summary-comprehensive-${now}`,
      type: 'assistant_response',
      summary: `[Summary of ${pointers.length} messages]`,
      fullContent: lines.join('\n'),
      timestamp: now,
      associations: pointers.map(p => p.id)
    }
  }

  private estimateTokens(pointers: MemoryPointer[]): number {
    return pointers.reduce((sum, p) => sum + Math.ceil(p.fullContent.length / 4), 0)
  }
}
