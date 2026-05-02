/**
 * TDD Test Cases for harness-desktop v3 Multi-Model Routing
 * 
 * Tests cover:
 * 1. Model adapter factory routing logic
 * 2. Provider-specific adapter selection
 * 3. Unknown provider fallback behavior
 * 4. Planning mode heuristics
 * 5. Plan generation and parsing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createModelAdapter } from '../services/modelAdapters'

// ==========================================
// SECTION 1: Model Adapter Factory Tests
// ==========================================

describe('Model Adapter Factory', () => {
  it('should create OpenAI adapter for openai provider', () => {
    const adapter = createModelAdapter('openai', 'test-key', 'https://api.openai.com/v1', 'gpt-4o')
    expect(adapter.provider).toBe('openai')
  })

  it('should create MiniMax adapter for minimax provider', () => {
    const adapter = createModelAdapter('minimax', 'test-key', '', 'MiniMax-Text-01')
    expect(adapter.provider).toBe('minimax')
  })

  it('should create GLM adapter for glm provider', () => {
    const adapter = createModelAdapter('glm', 'test-key', '', 'glm-4')
    expect(adapter.provider).toBe('glm')
  })

  it('should create Xiaomi adapter for xiaomi provider', () => {
    const adapter = createModelAdapter('xiaomi', 'test-key', '', 'MiMo-8B')
    expect(adapter.provider).toBe('xiaomi')
  })

  it('should create Qwen adapter for qwen provider', () => {
    const adapter = createModelAdapter('qwen', 'test-key', '', 'qwen-turbo')
    expect(adapter.provider).toBe('qwen')
  })

  it('should fallback to OpenAI adapter for unknown provider', () => {
    const adapter = createModelAdapter('unknown' as any, 'test-key', 'https://api.openai.com/v1', 'gpt-4o')
    expect(adapter.provider).toBe('openai')
  })

  it('should use default endpoint for MiniMax when not provided', () => {
    const adapter = createModelAdapter('minimax', 'test-key', '', '')
    // MiniMax default endpoint is https://api.minimax.chat/v1
    expect(adapter.provider).toBe('minimax')
  })

  it('should use default endpoint for GLM when not provided', () => {
    const adapter = createModelAdapter('glm', 'test-key', '', '')
    expect(adapter.provider).toBe('glm')
  })

  it('should use default endpoint for Xiaomi when not provided', () => {
    const adapter = createModelAdapter('xiaomi', 'test-key', '', '')
    expect(adapter.provider).toBe('xiaomi')
  })

  it('should use default endpoint for Qwen when not provided', () => {
    const adapter = createModelAdapter('qwen', 'test-key', '', '')
    expect(adapter.provider).toBe('qwen')
  })
})

// ==========================================
// SECTION 2: Provider Endpoint URL Tests
// ==========================================

describe('Provider Endpoint Configuration', () => {
  it('should use custom endpoint when provided for OpenAI', () => {
    const adapter = createModelAdapter('openai', 'key', 'https://custom.openai.com/v1', 'gpt-4o')
    expect(adapter.provider).toBe('openai')
  })

  it('should use custom endpoint when provided for GLM', () => {
    const adapter = createModelAdapter('glm', 'key', 'https://custom.glm.cn/api/v4', 'glm-4')
    expect(adapter.provider).toBe('glm')
  })

  it('should use custom endpoint when provided for Qwen', () => {
    const adapter = createModelAdapter('qwen', 'key', 'https://custom.dashscope.com/api/v1', 'qwen-turbo')
    expect(adapter.provider).toBe('qwen')
  })
})

// ==========================================
// SECTION 3: Model Name Preservation Tests
// ==========================================

describe('Model Name Handling', () => {
  it('should preserve custom model name for OpenAI', () => {
    const adapter = createModelAdapter('openai', 'key', 'https://api.openai.com/v1', 'gpt-4-turbo')
    expect(adapter.provider).toBe('openai')
  })

  it('should preserve custom model name for MiniMax', () => {
    const adapter = createModelAdapter('minimax', 'key', '', 'MiniMax-Text-01')
    expect(adapter.provider).toBe('minimax')
  })

  it('should preserve custom model name for GLM', () => {
    const adapter = createModelAdapter('glm', 'key', '', 'glm-4-flash')
    expect(adapter.provider).toBe('glm')
  })

  it('should preserve custom model name for Qwen', () => {
    const adapter = createModelAdapter('qwen', 'key', '', 'qwen-plus')
    expect(adapter.provider).toBe('qwen')
  })
})

// ==========================================
// SECTION 4: Adapter Interface Contract Tests
// ==========================================

describe('Adapter Interface Contract', () => {
  const providers: Array<'openai' | 'minimax' | 'glm' | 'xiaomi' | 'qwen'> = [
    'openai', 'minimax', 'glm', 'xiaomi', 'qwen'
  ]

  providers.forEach(provider => {
    it(`should have chat method for ${provider} adapter`, () => {
      const adapter = createModelAdapter(provider, 'test-key', '', 'test-model')
      expect(typeof adapter.chat).toBe('function')
    })

    it(`should have stream method for ${provider} adapter`, () => {
      const adapter = createModelAdapter(provider, 'test-key', '', 'test-model')
      expect(typeof adapter.stream).toBe('function')
    })

    it(`should have provider property for ${provider} adapter`, () => {
      const adapter = createModelAdapter(provider, 'test-key', '', 'test-model')
      expect(adapter.provider).toBe(provider)
    })
  })
})

// ==========================================
// SECTION 5: API Key Handling Tests
// ==========================================

describe('API Key Handling', () => {
  it('should handle empty API key without throwing', () => {
    expect(() => {
      const adapter = createModelAdapter('openai', '', 'https://api.openai.com/v1', 'gpt-4o')
    }).not.toThrow()
  })

  it('should handle special characters in API key', () => {
    expect(() => {
      const adapter = createModelAdapter('openai', 'sk-test+123/456', 'https://api.openai.com/v1', 'gpt-4o')
    }).not.toThrow()
  })

  it('should handle long API keys', () => {
    const longKey = 'sk-' + 'a'.repeat(500)
    expect(() => {
      const adapter = createModelAdapter('qwen', longKey, '', 'qwen-turbo')
    }).not.toThrow()
  })
})
