import type { MemoryPointer } from '../../types'

/**
 * Compression levels - escalation based on token pressure
 */
export type CompressionLevel = 'lightweight' | 'moderate' | 'aggressive'

/**
 * Result of a compression operation
 */
export interface CompressionResult {
  level: CompressionLevel
  originalCount: number
  compressedCount: number
  originalTokens: number
  compressedTokens: number
  savedTokens: number
  savedRatio: number
  summary?: string
  compressedPointers: MemoryPointer[]
}

/**
 * Compression strategy interface
 */
export interface CompressionStrategy {
  level: CompressionLevel
  compress(pointers: MemoryPointer[], maxTokens: number): CompressionResult
  shouldCompress(currentTokens: number, maxTokens: number): boolean
}

/**
 * Thresholds for each compression level
 */
export const COMPRESSION_THRESHOLDS = {
  LIGHTWEIGHT: 0.70,  // 70% of max tokens
  MODERATE: 0.85,    // 85% of max tokens
  AGGRESSIVE: 0.95   // 95% of max tokens
} as const

/**
 * Configuration for compression behavior
 */
export interface CompressionConfig {
  maxTokens: number
  keepRecentCount: number  // Number of recent messages to always keep intact
  summaryMaxTokens: number  // Max tokens for generated summaries
  criticalTypes: MemoryPointer['type'][]  // Types that should never be compressed
}

/**
 * Default compression config
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  maxTokens: 128000,
  keepRecentCount: 20,
  summaryMaxTokens: 500,
  criticalTypes: ['tool_call']  // Tool calls are generally more important
}
