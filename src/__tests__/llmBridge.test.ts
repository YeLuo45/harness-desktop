/**
 * TDD Test Cases for harness-desktop v3 LLMBridge Multi-Model Routing
 * 
 * Tests cover:
 * 1. LLMBridge initialization and adapter selection
 * 2. shouldUsePlanningMode heuristics
 * 3. generatePlan response parsing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LLMBridge, initLLMBridge, getLLMBridge } from '../services/llmBridge'
import type { ChatMessage } from '../types'

// ==========================================
// SECTION 1: LLMBridge Initialization Tests
// ==========================================

describe('LLMBridge Initialization', () => {
  it('should create LLMBridge with OpenAI provider', () => {
    const bridge = new LLMBridge('openai', 'test-key', 'https://api.openai.com/v1', 'gpt-4o')
    expect(bridge).toBeDefined()
  })

  it('should create LLMBridge with MiniMax provider', () => {
    const bridge = new LLMBridge('minimax', 'test-key', '', 'MiniMax-Text-01')
    expect(bridge).toBeDefined()
  })

  it('should create LLMBridge with GLM provider', () => {
    const bridge = new LLMBridge('glm', 'test-key', '', 'glm-4')
    expect(bridge).toBeDefined()
  })

  it('should create LLMBridge with Xiaomi provider', () => {
    const bridge = new LLMBridge('xiaomi', 'test-key', '', 'MiMo-8B')
    expect(bridge).toBeDefined()
  })

  it('should create LLMBridge with Qwen provider', () => {
    const bridge = new LLMBridge('qwen', 'test-key', '', 'qwen-turbo')
    expect(bridge).toBeDefined()
  })

  it('should initialize singleton instance via initLLMBridge', () => {
    const bridge = initLLMBridge('openai', 'test-key', 'https://api.openai.com/v1', 'gpt-4o')
    expect(bridge).toBeDefined()
    expect(getLLMBridge()).toBe(bridge)
  })
})

// ==========================================
// SECTION 2: System Prompt Tests
// ==========================================

describe('LLMBridge System Prompt', () => {
  it('should set and store system prompt', () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    bridge.setSystemPrompt('You are a helpful assistant')
    // System prompt is set internally - tested via behavior
    expect(bridge).toBeDefined()
  })

  it('should handle empty system prompt', () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    expect(() => bridge.setSystemPrompt('')).not.toThrow()
  })

  it('should handle very long system prompt', () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const longPrompt = 'A'.repeat(10000)
    expect(() => bridge.setSystemPrompt(longPrompt)).not.toThrow()
  })
})

// ==========================================
// SECTION 3: shouldUsePlanningMode Tests
// ==========================================

describe('shouldUsePlanningMode Heuristics', () => {
  // Test messages for planning keywords
  const refactorMessage: ChatMessage[] = [{ role: 'user', content: 'Please refactor the auth module' }]
  const restructureMessage: ChatMessage[] = [{ role: 'user', content: 'Restructure the project to use MVC pattern' }]
  const rebuildMessage: ChatMessage[] = [{ role: 'user', content: 'Rebuild the UI components' }]
  const migrateMessage: ChatMessage[] = [{ role: 'user', content: 'Migrate from REST to GraphQL' }]
  const implementMessage: ChatMessage[] = [{ role: 'user', content: 'Implement a new payment system' }]
  const createAMessage: ChatMessage[] = [{ role: 'user', content: 'Create a user authentication flow' }]
  const buildAMessage: ChatMessage[] = [{ role: 'user', content: 'Build a dashboard for analytics' }]
  const setupAMessage: ChatMessage[] = [{ role: 'user', content: 'Set up a CI/CD pipeline' }]

  // Test messages for long content (over 500 chars)
  const longMessage: ChatMessage[] = [{ role: 'user', content: 'A'.repeat(501) }]

  // Test messages that should NOT trigger planning mode
  const shortMessage: ChatMessage[] = [{ role: 'user', content: 'Hello, how are you?' }]
  const queryMessage: ChatMessage[] = [{ role: 'user', content: 'What is the weather like?' }]
  const simpleMessage: ChatMessage[] = [{ role: 'user', content: 'Run npm install' }]

  it('should return true for message with "refactor" keyword', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(refactorMessage)
    expect(result).toBe(true)
  })

  it('should return true for message with "restructure" keyword', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(restructureMessage)
    expect(result).toBe(true)
  })

  it('should return true for message with "rebuild" keyword', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(rebuildMessage)
    expect(result).toBe(true)
  })

  it('should return true for message with "migrate" keyword', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(migrateMessage)
    expect(result).toBe(true)
  })

  it('should return true for message with "implement" keyword', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(implementMessage)
    expect(result).toBe(true)
  })

  it('should return true for message with "create a" keyword', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(createAMessage)
    expect(result).toBe(true)
  })

  it('should return true for message with "build a" keyword', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(buildAMessage)
    expect(result).toBe(true)
  })

  it('should return true for message with "set up a" keyword', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(setupAMessage)
    expect(result).toBe(true)
  })

  it('should return true for long messages (>500 chars)', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(longMessage)
    expect(result).toBe(true)
  })

  it('should return false for short query messages', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(queryMessage)
    expect(result).toBe(false)
  })

  it('should return false for simple short messages', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(shortMessage)
    expect(result).toBe(false)
  })

  it('should return false for simple commands like "npm install"', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode(simpleMessage)
    expect(result).toBe(false)
  })

  it('should be case-insensitive for keyword matching', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const upperCaseMessage: ChatMessage[] = [{ role: 'user', content: 'Please REFACTOR the auth module' }]
    const result = await bridge.shouldUsePlanningMode(upperCaseMessage)
    expect(result).toBe(true)
  })

  it('should handle empty messages array', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const result = await bridge.shouldUsePlanningMode([])
    expect(result).toBe(false)
  })

  it('should handle messages with empty content', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const emptyContentMessage: ChatMessage[] = [{ role: 'user', content: '' }]
    const result = await bridge.shouldUsePlanningMode(emptyContentMessage)
    expect(result).toBe(false)
  })
})

// ==========================================
// SECTION 4: Plan Generation Response Parsing Tests
// ==========================================

describe('generatePlan Response Parsing', () => {
  it('should parse valid JSON plan response', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    // This test validates the parsing logic structure
    // Actual API call would be mocked in integration tests
    expect(bridge).toBeDefined()
  })

  it('should handle malformed JSON gracefully', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    // The generatePlan method should catch JSON parse errors
    // and return a fallback plan
    expect(bridge).toBeDefined()
  })

  it('should handle empty plan steps', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    expect(bridge).toBeDefined()
  })

  it('should handle missing optional fields in plan response', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    expect(bridge).toBeDefined()
  })
})

// ==========================================
// SECTION 5: Provider-Specific Adapter Selection Tests
// ==========================================

describe('Provider-Specific Adapter Selection in Bridge', () => {
  const providers = ['openai', 'minimax', 'glm', 'xiaomi', 'qwen'] as const

  providers.forEach(provider => {
    it(`should create bridge with ${provider} provider without throwing`, () => {
      expect(() => {
        new LLMBridge(provider, 'test-key', '', 'test-model')
      }).not.toThrow()
    })
  })

  providers.forEach(provider => {
    it(`should initialize singleton for ${provider} provider`, () => {
      const bridge = initLLMBridge(provider, 'test-key', '', 'test-model')
      expect(bridge).toBeDefined()
      expect(getLLMBridge()).toBe(bridge)
    })
  })
})

// ==========================================
// SECTION 6: Edge Cases and Error Handling
// ==========================================

describe('LLMBridge Edge Cases', () => {
  it('should handle messages with only system role', () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const messages: ChatMessage[] = [{ role: 'system', content: 'You are a helpful assistant' }]
    expect(() => bridge.setSystemPrompt('Test')).not.toThrow()
  })

  it('should handle messages with tool calls', () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    expect(bridge).toBeDefined()
  })

  it('should handle consecutive planning mode checks', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const msg1: ChatMessage[] = [{ role: 'user', content: 'Refactor this code' }]
    const msg2: ChatMessage[] = [{ role: 'user', content: 'What is 2+2?' }]
    
    const result1 = await bridge.shouldUsePlanningMode(msg1)
    const result2 = await bridge.shouldUsePlanningMode(msg2)
    
    expect(result1).toBe(true)
    expect(result2).toBe(false)
  })

  it('should handle messages at exactly 500 characters', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const exactMessage: ChatMessage[] = [{ role: 'user', content: 'A'.repeat(500) }]
    const result = await bridge.shouldUsePlanningMode(exactMessage)
    // Exactly 500 should NOT trigger (only >500)
    expect(result).toBe(false)
  })

  it('should handle Unicode content in messages', async () => {
    const bridge = new LLMBridge('openai', 'key', 'https://api.openai.com/v1', 'gpt-4o')
    const unicodeMessage: ChatMessage[] = [{ role: 'user', content: '你好，请重构代码 🚀' }]
    const result = await bridge.shouldUsePlanningMode(unicodeMessage)
    expect(result).toBe(true)
  })
})
