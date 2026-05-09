// Provider types and interfaces
export * from './types'

// Provider Registry
export * from './registry'

// Built-in providers
export { OpenAIProvider, createOpenAIProvider } from './built-in/openai'
export { MiniMaxProvider, createMiniMaxProvider } from './built-in/minimax'
export { GLMProvider, createGLMProvider } from './built-in/glm'
export { XiaomiProvider, createXiaomiProvider } from './built-in/xiaomi'
export { QwenProvider, createQwenProvider } from './built-in/qwen'

import { getProviderRegistry } from './registry'
import { createOpenAIProvider } from './built-in/openai'
import { createMiniMaxProvider } from './built-in/minimax'
import { createGLMProvider } from './built-in/glm'
import { createXiaomiProvider } from './built-in/xiaomi'
import { createQwenProvider } from './built-in/qwen'
import type { ProviderConfig } from './types'

/**
 * Initialize the provider registry with all built-in providers
 */
export function initBuiltInProviders(): void {
  const registry = getProviderRegistry()

  // Register factories for built-in providers
  registry.registerFactory('openai', (config: ProviderConfig) => createOpenAIProvider(config))
  registry.registerFactory('minimax', (config: ProviderConfig) => createMiniMaxProvider(config))
  registry.registerFactory('glm', (config: ProviderConfig) => createGLMProvider(config))
  registry.registerFactory('xiaomi', (config: ProviderConfig) => createXiaomiProvider(config))
  registry.registerFactory('qwen', (config: ProviderConfig) => createQwenProvider(config))
}
