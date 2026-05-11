import type { MemoryPointer } from '../../types'
import type { CompressionLevel, CompressionResult, CompressionConfig } from './types'
import { LightweightCompressionStrategy } from './strategies/lightweight'
import { ModerateCompressionStrategy } from './strategies/moderate'
import { AggressiveCompressionStrategy } from './strategies/aggressive'
import { DEFAULT_COMPRESSION_CONFIG, COMPRESSION_THRESHOLDS } from './types'

/**
 * Compression options for fine-grained control
 */
export interface CompressionOptions {
  /** Force a specific compression level, overriding adaptive selection */
  level?: CompressionLevel
  /** Callback when compression completes */
  onCompressionComplete?: (result: CompressionResult) => void
}

/**
 * CompressionOrchestrator - selects and executes the appropriate compression strategy
 * based on current token usage or forced level
 */
export class CompressionOrchestrator {
  private lightweight = new LightweightCompressionStrategy()
  private moderate = new ModerateCompressionStrategy(DEFAULT_COMPRESSION_CONFIG.keepRecentCount)
  private aggressive = new AggressiveCompressionStrategy()

  constructor(private config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG) {}

  /**
   * Determine the appropriate compression level based on current token count
   * Uses adaptive thresholds:
   * - 70-84%: lightweight
   * - 85-94%: moderate
   * - 95%+: aggressive
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
   * Get compression level based on token usage percentage (0-100)
   * More intuitive API for some use cases
   */
  getCompressionLevelByUsage(tokenUsagePercent: number): CompressionLevel | null {
    if (tokenUsagePercent >= 95) return 'aggressive'
    if (tokenUsagePercent >= 90) return 'moderate'
    if (tokenUsagePercent >= 80) return 'lightweight'
    return null
  }

  /**
   * Check if compression is needed
   */
  needsCompression(currentTokens: number): boolean {
    return this.getCompressionLevel(currentTokens) !== null
  }

  /**
   * Execute compression with the appropriate strategy or forced level
   */
  compress(pointers: MemoryPointer[], currentTokens: number, options?: CompressionOptions): CompressionResult | null {
    // Determine compression level
    let level: CompressionLevel | null = null

    if (options?.level) {
      // Forced level from options
      level = options.level
    } else {
      // Adaptive selection based on token usage
      level = this.getCompressionLevel(currentTokens)
    }

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

    const result = strategy.compress(pointers, this.config.maxTokens)

    // Call completion callback if provided
    if (options?.onCompressionComplete) {
      options.onCompressionComplete(result)
    }

    return result
  }

  /**
   * Execute compression with forced level (backwards compatibility)
   */
  compressWithLevel(pointers: MemoryPointer[], level: CompressionLevel): CompressionResult {
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
   * Calculate token usage percentage
   */
  getTokenUsagePercent(pointers: MemoryPointer[]): number {
    const tokens = this.estimateTokenCount(pointers)
    return (tokens / this.config.maxTokens) * 100
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

  /**
   * Get configuration
   */
  getConfig(): CompressionConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config }
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
