import type { MemoryPointer } from '../../types'
import type { CompressionLevel, CompressionResult, CompressionConfig } from './types'
import { LightweightCompressionStrategy } from './strategies/lightweightStrategy'
import { ModerateCompressionStrategy } from './strategies/moderateStrategy'
import { AggressiveCompressionStrategy } from './strategies/aggressiveStrategy'
import { DEFAULT_COMPRESSION_CONFIG, COMPRESSION_THRESHOLDS } from './types'

/**
 * CompressionOrchestrator - selects and executes the appropriate compression strategy
 * based on current token usage
 */
export class CompressionOrchestrator {
  private lightweight = new LightweightCompressionStrategy()
  private moderate = new ModerateCompressionStrategy(DEFAULT_COMPRESSION_CONFIG.keepRecentCount)
  private aggressive = new AggressiveCompressionStrategy()

  constructor(private config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG) {}

  /**
   * Determine the appropriate compression level based on current token count
   */
  getCompressionLevel(currentTokens: number): CompressionLevel | null {
    const { maxTokens } = this.config

    if (currentTokens >= maxTokens * COMPRESSION_THRESHOLDS.AGGRESSIVE) {
      return 'aggressive'
    }
    if (currentTokens >= maxTokens * COMPRESSION_THRESHOLDS.MODERATE) {
      return 'moderate'
    }
    if (currentTokens >= maxTokens * COMPRESSION_THRESHOLDS.LIGHTWEIGHT) {
      return 'lightweight'
    }
    return null
  }

  /**
   * Check if compression is needed
   */
  needsCompression(currentTokens: number): boolean {
    return this.getCompressionLevel(currentTokens) !== null
  }

  /**
   * Execute compression with the appropriate strategy
   */
  compress(pointers: MemoryPointer[], currentTokens: number): CompressionResult | null {
    const level = this.getCompressionLevel(currentTokens)

    if (!level) {
      return null
    }

    let strategy: { compress: (p: MemoryPointer[], m: number) => CompressionResult; level: CompressionLevel }

    switch (level) {
      case 'lightweight':
        strategy = this.lightweight
        break
      case 'moderate':
        strategy = this.moderate
        break
      case 'aggressive':
        strategy = this.aggressive
        break
    }

    return strategy.compress(pointers, this.config.maxTokens)
  }

  /**
   * Get current token count estimate from pointers
   */
  estimateTokenCount(pointers: MemoryPointer[]): number {
    return pointers.reduce((sum, p) => sum + Math.ceil(p.fullContent.length / 4), 0)
  }

  /**
   * Check if we should compress and return both level and result
   */
  shouldCompressAndRun(
    pointers: MemoryPointer[],
    currentTokens?: number
  ): { shouldCompress: boolean; level: CompressionLevel | null; result: CompressionResult | null } {
    const tokens = currentTokens ?? this.estimateTokenCount(pointers)
    const level = this.getCompressionLevel(tokens)

    if (!level) {
      return { shouldCompress: false, level: null, result: null }
    }

    const result = this.compress(pointers, tokens)
    return { shouldCompress: true, level, result }
  }
}

// Singleton
let orchestratorInstance: CompressionOrchestrator | null = null

export function getCompressionOrchestrator(): CompressionOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new CompressionOrchestrator()
  }
  return orchestratorInstance
}

export function initCompressionOrchestrator(config?: CompressionConfig): CompressionOrchestrator {
  orchestratorInstance = new CompressionOrchestrator(config)
  return orchestratorInstance
}
