import type { MemoryPointer } from '../../../types'
import type { CompressionStrategy, CompressionResult } from '../types'

/**
 * Lightweight Compression Strategy (Level 1)
 * 
 * - Merges similar pointers by type + summary prefix
 * - Preserves all timestamps
 * - Target: 30% pointer reduction
 */
export class LightweightCompressionStrategy implements CompressionStrategy {
  level: 'lightweight' = 'lightweight'

  shouldCompress(currentTokens: number, maxTokens: number): boolean {
    return currentTokens >= maxTokens * 0.70
  }

  compress(pointers: MemoryPointer[], maxTokens: number): CompressionResult {
    const originalCount = pointers.length
    const originalTokens = this.estimateTokens(pointers)

    // Group similar pointers by type and summary prefix (first 50 chars)
    const groups = new Map<string, MemoryPointer[]>()

    for (const pointer of pointers) {
      const key = `${pointer.type}:${pointer.summary.slice(0, 50)}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(pointer)
    }

    // Merge groups with more than 2 similar pointers
    const compressed: MemoryPointer[] = []

    for (const [key, group] of groups) {
      if (group.length > 2) {
        // Keep one pointer with merged summary
        const primary = group[0]
        const mergedAssociations = group.flatMap(p => p.associations)
        
        // Deduplicate associations while preserving order
        const uniqueAssociations = [...new Set(mergedAssociations)]

        compressed.push({
          ...primary,
          id: `merged-${primary.id}-${Date.now()}`,
          summary: `[Merged ${group.length} ${primary.type} messages] ${primary.summary}`,
          fullContent: `Merged content from ${group.length} ${primary.type} messages:\n${group.map(p => p.fullContent).join('\n---\n')}`,
          associations: uniqueAssociations
        })
      } else {
        // Keep all as-is for small groups
        compressed.push(...group)
      }
    }

    // Sort by timestamp to preserve chronological order
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
      summary: `Lightweight: merged ${originalCount - compressed.length} similar pointers`,
      compressedPointers: compressed
    }
  }

  private estimateTokens(pointers: MemoryPointer[]): number {
    return pointers.reduce((sum, p) => sum + Math.ceil(p.fullContent.length / 4), 0)
  }
}
