import type { MemoryPointer } from '../../../types'
import type { CompressionStrategy, CompressionResult } from '../types'

/**
 * Lightweight compression - merge similar pointers without losing content
 * Triggered at 70% capacity
 */
export class LightweightCompressionStrategy implements CompressionStrategy {
  level: 'lightweight' = 'lightweight'

  shouldCompress(currentTokens: number, maxTokens: number): boolean {
    return currentTokens >= maxTokens * 0.70
  }

  compress(pointers: MemoryPointer[], maxTokens: number): CompressionResult {
    const originalCount = pointers.length
    const originalTokens = this.estimateTokens(pointers)

    // Group similar pointers by type and summary prefix
    const groups = new Map<string, MemoryPointer[]>()

    for (const pointer of pointers) {
      const key = `${pointer.type}:${pointer.summary.slice(0, 50)}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(pointer)
    }

    // Merge groups that have more than 2 similar pointers
    const compressed: MemoryPointer[] = []
    const merged: string[] = []

    for (const [key, group] of groups) {
      if (group.length > 2) {
        // Keep one pointer with updated summary indicating merge
        const primary = group[0]
        compressed.push({
          ...primary,
          summary: `[Merged ${group.length} ${primary.type} messages] ${primary.summary}`,
          associations: group.flatMap(p => p.associations)
        })
        merged.push(key)
      } else {
        // Keep all as-is
        compressed.push(...group)
      }
    }

    // Sort back by timestamp
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
      compressedPointers: compressed
    }
  }

  private estimateTokens(pointers: MemoryPointer[]): number {
    return pointers.reduce((sum, p) => sum + Math.ceil(p.fullContent.length / 4), 0)
  }
}
