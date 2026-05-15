import type { ChatMessage, ChatResponse, StreamOptions } from '../../../types'
import type { LLMProvider, ProviderConfig, ValidationResult, ProviderCapabilities } from '../types'
import { validateApiKey, validateEndpoint, validateModel } from '../registry'

/**
 * Base adapter with common functionality
 */
export abstract class BaseAdapter implements LLMProvider {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly defaultEndpoint: string
  abstract readonly defaultModel: string

  constructor(protected config: ProviderConfig) {
    this.config = {
      ...this.getDefaultConfig(),
      ...config
    }
  }

  protected abstract getDefaultConfig(): Partial<ProviderConfig>

  get endpoint(): string {
    return (this.config.endpoint as string) || this.defaultEndpoint
  }

  get modelName(): string {
    return (this.config.model as string) || this.defaultModel
  }

  abstract chat(options: { messages: ChatMessage[]; systemPrompt?: string; tools?: any[] }): Promise<ChatResponse>
  abstract stream(options: StreamOptions): void

  getCapabilities(): ProviderCapabilities {
    return {
      maxTokens: 128000,
      streaming: true,
      tools: true,
      vision: false
    }
  }

  validateConfig(config: ProviderConfig): ValidationResult {
    const allErrors: string[] = []

    const keyResult = validateApiKey(this.id, (config.apiKey as string) || '')
    if (!keyResult.valid) allErrors.push(...keyResult.errors || [])

    const endpointResult = validateEndpoint((config.endpoint as string) || this.defaultEndpoint)
    if (!endpointResult.valid) allErrors.push(...endpointResult.errors || [])

    const modelResult = validateModel(config.model || this.defaultModel)
    if (!modelResult.valid) allErrors.push(...modelResult.errors || [])

    return { valid: allErrors.length === 0, errors: allErrors.length > 0 ? allErrors : undefined }
  }

  protected async fetchWithTimeout(url: string, options: RequestInit, timeout = 60000): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  protected buildMessages(messages: ChatMessage[], systemPrompt?: string): ChatMessage[] {
    const allMessages: ChatMessage[] = []
    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt })
    }
    allMessages.push(...messages)
    return allMessages
  }
}
