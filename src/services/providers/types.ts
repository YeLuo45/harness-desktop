import type { ChatMessage, ChatResponse, StreamOptions, ModelProvider } from '../../types'

/**
 * Provider capabilities - what features does this provider support
 */
export interface ProviderCapabilities {
  maxTokens: number
  streaming: boolean
  tools: boolean
  vision?: boolean
}

/**
 * Result of validating provider configuration
 */
export interface ValidationResult {
  valid: boolean
  errors?: string[]
  warnings?: string[]
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  apiKey: string
  endpoint?: string
  modelName: string
}

/**
 * Chat options passed to provider
 */
export interface ChatOptions {
  messages: ChatMessage[]
  systemPrompt?: string
  tools?: any[]
}

/**
 * LLM Provider interface - pluggable provider contract
 * Inspired by hermes-agent's provider-agnostic design
 */
export interface LLMProvider {
  /** Unique identifier for this provider */
  readonly id: string
  /** Human-readable name */
  readonly name: string
  /** Default endpoint if none provided */
  readonly defaultEndpoint: string
  /** Default model name */
  readonly defaultModel: string

  /**
   * Send a chat request
   */
  chat(options: ChatOptions): Promise<ChatResponse>

  /**
   * Start a streaming chat
   */
  stream(options: StreamOptions): void

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities

  /**
   * Validate provider configuration
   */
  validateConfig(config: ProviderConfig): ValidationResult
}

/**
 * Provider factory function type
 */
export type ProviderFactory = (config: ProviderConfig) => LLMProvider

/**
 * Built-in provider IDs
 */
export const BUILT_IN_PROVIDERS = [
  'openai',
  'minimax',
  'glm',
  'xiaomi',
  'qwen'
] as const

export type BuiltInProviderId = typeof BUILT_IN_PROVIDERS[number]
