import type { MemoryPointer } from '../../../types'
import type { CompressionStrategy, CompressionResult } from '../types'

/**
 * Aggressive Compression Strategy (Level 3)
 * 
 * - Only keeps recent N critical pointers
 * - Replaces content with summaries
 * - Target: 80% pointer reduction
 */
export class AggressiveCompressionStrategy implements CompressionStrategy {
  level: 'aggressive' = 'aggressive'

  constructor(
    private keepRecentCount = 5,
    private summaryMaxTokens = 500
  ) {}

  shouldCompress(currentTokens: number, maxTokens: number): boolean {
    return currentTokens >= maxTokens * 0.95
  }

  compress(pointers: MemoryPointer[], maxTokens: number): CompressionResult {
    const originalCount = pointers.length
    const originalTokens = this.estimateTokens(pointers)

    // Sort by timestamp (newest first)
    const sorted = [...pointers].sort((a, b) => b.timestamp - a.timestamp)

    // Extract critical pointers
    const critical = this.extractCriticalPointers(sorted)
    const compressible = sorted.filter(p => !critical.some(c => c.id === p.id))

    // Generate comprehensive summary
    const summaryPointer = this.generateSummary(compressible, originalCount)

    // Final: critical pointers + summary
    const compressed: MemoryPointer[] = [
      ...critical,
      summaryPointer
    ]

    // Sort by timestamp for chronological order
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
      summary: `Aggressive: ${originalCount} → ${compressed.length} (${Math.round((1 - compressedTokens / originalTokens) * 100)}% reduction)`,
      compressedPointers: compressed
    }
  }

  /**
   * Extract critical pointers that should never be compressed
   */
  private extractCriticalPointers(pointers: MemoryPointer[]): MemoryPointer[] {
    const critical: MemoryPointer[] = []
    const seen = new Set<string>()

    // 1. Most recent N pointers (newest first)
    const recent = pointers.slice(0, this.keepRecentCount)
    for (const p of recent) {
      if (!seen.has(p.id)) {
        critical.push(p)
        seen.add(p.id)
      }
    }

    // 2. Pointers with associations (related to other important content)
    const withAssociations = pointers.filter(p => p.associations.length > 0)
    for (const p of withAssociations) {
      if (!seen.has(p.id)) {
        critical.push(p)
        seen.add(p.id)
      }
    }

    // 3. Tool calls (generally important for context)
    const toolCalls = pointers.filter(p => p.type === 'tool_call')
    for (const p of toolCalls) {
      if (!seen.has(p.id)) {
        critical.push(p)
        seen.add(p.id)
      }
    }

    // 4. Most recent user input
    const userInputs = pointers
      .filter(p => p.type === 'user_input')
      .sort((a, b) => b.timestamp - a.timestamp)
    if (userInputs.length > 0 && !seen.has(userInputs[0].id)) {
      critical.push(userInputs[0])
      seen.add(userInputs[0].id)
    }

    return critical
  }

  /**
   * Generate comprehensive summary replacing compressible content
   */
  private generateSummary(pointers: MemoryPointer[], totalOriginal: number): MemoryPointer {
    const now = Date.now()

    // Group by type for structured summary
    const byType = new Map<MemoryPointer['type'], { count: number; summaries: string[] }>()

    for (const ptr of pointers) {
      if (!byType.has(ptr.type)) {
        byType.set(ptr.type, { count: 0, summaries: [] })
      }
      const entry = byType.get(ptr.type)!
      entry.count++
      // Add unique summary prefix
      const prefix = ptr.summary.slice(0, 80)
      if (!entry.summaries.includes(prefix)) {
        entry.summaries.push(prefix)
      }
    }

    // Build structured summary content
    const lines: string[] = [
      `[COMPREHENSIVE CONVERSATION SUMMARY - ${totalOriginal} total messages]`,
      ''
    ]

    const typeOrder: MemoryPointer['type'][] = ['user_input', 'assistant_response', 'tool_call', 'tool_result']

    for (const type of typeOrder) {
      const entry = byType.get(type)
      if (entry) {
        lines.push(`## ${type.toUpperCase()} (${entry.count} messages)`)
        lines.push('Key points:')
        const uniqueSummaries = entry.summaries.slice(0, 5)
        for (const s of uniqueSummaries) {
          lines.push(`  • ${s}`)
        }
        if (entry.count > 5) {
          lines.push(`  • ... and ${entry.count - 5} more ${type} messages`)
        }
        lines.push('')
      }
    }

    // Include association map for related content
    const allAssociations = pointers.flatMap(p => p.associations)
    if (allAssociations.length > 0) {
      lines.push('## RELATED CONTEXT')
      lines.push(`This conversation has ${allAssociations.length} cross-references to earlier content`)
    }

    return {
      id: `summary-aggressive-${now}`,
      type: 'assistant_response',
      summary: `[Summary of ${pointers.length} messages from ${totalOriginal} total]`,
      fullContent: lines.join('\n'),
      timestamp: now,
      associations: pointers.map(p => p.id)
    }
  }

  private estimateTokens(pointers: MemoryPointer[]): number {
    return pointers.reduce((sum, p) => sum + Math.ceil(p.fullContent.length / 4), 0)
  }
}
