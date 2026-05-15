import type { LLMProvider, ProviderFactory, ProviderConfig, ValidationResult, ProviderCapabilities } from './types'

/**
 * Provider Registry - singleton for managing LLM providers
 * Inspired by hermes-agent's pluggable provider architecture
 */
class ProviderRegistryImpl {
  private providers = new Map<string, LLMProvider>()
  private factories = new Map<string, ProviderFactory>()
  private activeProviderId: string | null = null

  /**
   * Register a provider instance directly
   */
  register(provider: LLMProvider): void {
    if (this.providers.has(provider.id)) {
      console.warn(`[ProviderRegistry] Provider '${provider.id}' already registered, skipping`)
      return
    }
    this.providers.set(provider.id, provider)
    console.log(`[ProviderRegistry] Registered provider: ${provider.id}`)
  }

  /**
   * Register a provider factory for lazy instantiation
   */
  registerFactory(id: string, factory: ProviderFactory): void {
    if (this.factories.has(id)) {
      console.warn(`[ProviderRegistry] Factory '${id}' already registered, skipping`)
      return
    }
    this.factories.set(id, factory)
    console.log(`[ProviderRegistry] Registered factory: ${id}`)
  }

  /**
   * Unregister a provider
   */
  unregister(id: string): boolean {
    // If this is the active provider, clear active
    if (this.activeProviderId === id) {
      this.activeProviderId = null
    }
    const removed = this.providers.delete(id)
    this.factories.delete(id)
    if (removed) {
      console.log(`[ProviderRegistry] Unregistered provider: ${id}`)
    }
    return removed
  }

  /**
   * Get a provider by ID
   */
  get(id: string): LLMProvider | null {
    const provider = this.providers.get(id)
    if (provider) return provider

    // Try factory if provider not instantiated
    const factory = this.factories.get(id)
    if (factory) {
      // Return a placeholder that will create on first use
      return this.createProviderPlaceholder(id, factory)
    }

    return null
  }

  /**
   * Create and return a provider placeholder
   */
  private createProviderPlaceholder(id: string, factory: ProviderFactory): LLMProvider {
    let instance: LLMProvider | null = null

    return {
      id,
      name: id,
      defaultEndpoint: '',
      defaultModel: '',
      chat: async (options: { messages: any[]; systemPrompt?: string; tools?: any[] }) => {
        if (!instance) {
          instance = factory({
            name: id,
            apiKey: '',
            model: ''
          })
        }
        return instance.chat(options)
      },
      stream: (options: any) => {
        if (!instance) {
          instance = factory({
            name: id,
            apiKey: '',
            model: ''
          })
        }
        instance.stream(options)
      },
      getCapabilities: () => {
        if (!instance) {
          instance = factory({ name: id, apiKey: '', model: '' })
        }
        return instance.getCapabilities()
      },
      validateConfig: (config: ProviderConfig) => {
        if (!instance) {
          instance = factory(config)
        }
        return instance.validateConfig(config)
      }
    }
  }

  /**
   * Get the active provider
   */
  getActive(): LLMProvider | null {
    if (!this.activeProviderId) return null
    return this.providers.get(this.activeProviderId) || null
  }

  /**
   * Get the active provider ID
   */
  getActiveId(): string | null {
    return this.activeProviderId
  }

  /**
   * Set the active provider
   */
  setActive(id: string): boolean {
    const provider = this.providers.get(id)
    if (!provider) {
      console.warn(`[ProviderRegistry] Cannot set active: provider '${id}' not found`)
      return false
    }
    this.activeProviderId = id
    console.log(`[ProviderRegistry] Active provider set to: ${id}`)
    return true
  }

  /**
   * List all registered provider IDs
   */
  list(): string[] {
    const ids = new Set<string>()
    for (const id of Array.from(this.providers.keys())) {
      ids.add(id)
    }
    for (const id of Array.from(this.factories.keys())) {
      ids.add(id)
    }
    return Array.from(ids)
  }

  /**
   * Check if a provider is registered
   */
  has(id: string): boolean {
    return this.providers.has(id) || this.factories.has(id)
  }

  /**
   * Create a provider with config and set as active
   */
  createAndSetActive(id: string, config: ProviderConfig): LLMProvider | null {
    const factory = this.factories.get(id)
    if (!factory) {
      console.warn(`[ProviderRegistry] No factory for '${id}'`)
      return null
    }

    const provider = factory(config)
    this.providers.set(id, provider)
    this.activeProviderId = id
    return provider
  }

  /**
   * Clear all providers
   */
  clear(): void {
    this.providers.clear()
    this.factories.clear()
    this.activeProviderId = null
  }
}

// Singleton instance
let registryInstance: ProviderRegistryImpl | null = null

export function getProviderRegistry(): ProviderRegistryImpl {
  if (!registryInstance) {
    registryInstance = new ProviderRegistryImpl()
  }
  return registryInstance
}

export function initProviderRegistry(): ProviderRegistryImpl {
  registryInstance = new ProviderRegistryImpl()
  return registryInstance
}

// Validation utilities
export function validateApiKey(provider: string, key: string): ValidationResult {
  const errors: string[] = []

  if (!key) {
    errors.push('API key is required')
    return { valid: false, errors }
  }

  // Provider-specific validation
  switch (provider) {
    case 'openai':
      if (!key.startsWith('sk-')) {
        errors.push('OpenAI API key must start with "sk-"')
      }
      if (key.length < 40) {
        errors.push('OpenAI API key appears to be invalid (too short)')
      }
      break
    case 'minimax':
      if (!key) {
        errors.push('MiniMax API key is required')
      }
      break
    case 'glm':
      if (!key) {
        errors.push('GLM API key is required')
      }
      break
  }

  return { valid: errors.length === 0, errors }
}

export function validateEndpoint(url: string): ValidationResult {
  const errors: string[] = []

  if (!url) {
    return { valid: true, warnings: ['No endpoint provided, will use default'] }
  }

  try {
    new URL(url)
  } catch {
    errors.push('Invalid endpoint URL format')
  }

  return { valid: errors.length === 0, errors }
}

export function validateModel(model: string): ValidationResult {
  const errors: string[] = []

  if (!model || model.trim() === '') {
    errors.push('Model name is required')
  }

  return { valid: errors.length === 0, errors }
}
