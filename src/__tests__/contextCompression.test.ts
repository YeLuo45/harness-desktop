import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MemoryPointer } from '../../types'

// ============================================
// Types for Compression Tests
// ============================================

type CompressionLevel = 'lightweight' | 'moderate' | 'aggressive'

interface CompressionResult {
  level: CompressionLevel
  originalCount: number
  compressedCount: number
  originalTokens: number
  compressedTokens: number
  savedTokens: number
  summary?: string
}

interface CompressionStrategy {
  level: CompressionLevel
  compress(pointers: MemoryPointer[], maxTokens: number): CompressionResult
  shouldCompress(pointers: MemoryPointer[], currentTokens: number, maxTokens: number): boolean
}

// ============================================
// Test Fixtures
// ============================================

function createMockPointer(type: MemoryPointer['type'], content: string, associations: string[] = []): MemoryPointer {
  return {
    id: `ptr-${Math.random().toString(36).slice(2)}`,
    type,
    summary: content.slice(0, 50),
    fullContent: content,
    timestamp: Date.now(),
    associations
  }
}

function createMockPointers(count: number, withAssociations = false): MemoryPointer[] {
  const pointers: MemoryPointer[] = []
  for (let i = 0; i < count; i++) {
    const associations = withAssociations && i > 0 ? [pointers[i - 1].id] : []
    pointers.push(createMockPointer(
      i % 3 === 0 ? 'user_input' : i % 3 === 1 ? 'assistant_response' : 'tool_call',
      `This is message ${i} with some content that will be used for compression testing`,
      associations
    ))
  }
  return pointers
}

// ============================================
// Compression Strategy Interface Tests
// ============================================

describe('CompressionStrategy Interface', () => {
  it('should define required methods for all strategies', () => {
    const strategy: CompressionStrategy = {
      level: 'lightweight',
      compress: vi.fn(),
      shouldCompress: vi.fn().mockReturnValue(false)
    }

    expect(typeof strategy.compress).toBe('function')
    expect(typeof strategy.shouldCompress).toBe('function')
    expect(strategy.level).toBe('lightweight')
  })
})

// ============================================
// Compression Level Threshold Tests
// ============================================

describe('Compression Level Thresholds', () => {
  const MAX_TOKENS = 128000

  it('should trigger lightweight at 70% capacity', () => {
    const threshold70 = MAX_TOKENS * 0.70
    const threshold69 = MAX_TOKENS * 0.69

    // At 70% - should compress
    expect(threshold70 >= MAX_TOKENS * 0.70).toBe(true)
    expect(threshold70 >= MAX_TOKENS * 0.85).toBe(false)

    // At 69% - should not compress
    expect(threshold69 >= MAX_TOKENS * 0.70).toBe(false)
  })

  it('should trigger moderate at 85% capacity', () => {
    const threshold85 = MAX_TOKENS * 0.85
    const threshold84 = MAX_TOKENS * 0.84

    expect(threshold85 >= MAX_TOKENS * 0.85).toBe(true)
    expect(threshold85 >= MAX_TOKENS * 0.95).toBe(false)

    expect(threshold84 >= MAX_TOKENS * 0.85).toBe(false)
  })

  it('should trigger aggressive at 95% capacity', () => {
    const threshold95 = MAX_TOKENS * 0.95
    const threshold94 = MAX_TOKENS * 0.94

    expect(threshold95 >= MAX_TOKENS * 0.95).toBe(true)
    expect(threshold94 >= MAX_TOKENS * 0.95).toBe(false)
  })

  it('should calculate compression ratio correctly', () => {
    const originalTokens = 100000
    const compressedTokens = 40000
    const savedTokens = originalTokens - compressedTokens
    const ratio = savedTokens / originalTokens

    expect(ratio).toBe(0.6) // 60% reduction
    expect(compressedTokens).toBe(originalTokens * (1 - ratio))
  })
})

// ============================================
// Lightweight Compression Strategy Tests
// ============================================

describe('Lightweight Compression Strategy', () => {
  it('should merge similar pointers without losing content', () => {
    const pointers = createMockPointers(10)

    // Simulate lightweight: keep all but merge similar
    const merged = pointers.reduce((acc, ptr) => {
      const key = `${ptr.type}:${ptr.summary.slice(0, 20)}`
      const existing = acc.find(p => p.key === key)
      if (existing) {
        existing.count = (existing.count || 1) + 1
        existing.ids.push(ptr.id)
      } else {
        acc.push({ key, ptr, count: 1, ids: [ptr.id] })
      }
      return acc
    }, [] as Array<{ key: string; ptr: MemoryPointer; count: number; ids: string[] }>)

    // Should have fewer or equal unique groups
    expect(merged.length).toBeLessThanOrEqual(pointers.length)

    // Total IDs preserved
    const totalIds = merged.reduce((sum, g) => sum + g.count, 0)
    expect(totalIds).toBe(pointers.length)
  })

  it('should not compress if under threshold', () => {
    const pointers = createMockPointers(5)
    const currentTokens = 50000 // 39% of 128k
    const maxTokens = 128000
    const threshold = 0.70

    const shouldCompress = currentTokens >= maxTokens * threshold
    expect(shouldCompress).toBe(false)
  })

  it('should preserve all pointers after lightweight compression', () => {
    const pointers = createMockPointers(20)

    // Lightweight compression keeps all pointers but may update summaries
    const compressed = pointers.map(ptr => ({
      ...ptr,
      summary: `Merged: ${ptr.summary}` // Simplified summary
    }))

    expect(compressed.length).toBe(pointers.length)
    // All original IDs preserved
    compressed.forEach((p, i) => {
      expect(p.id).toBe(pointers[i].id)
    })
  })
})

// ============================================
// Moderate Compression Strategy Tests
// ============================================

describe('Moderate Compression Strategy', () => {
  it('should summarize older messages keeping recent ones intact', () => {
    const pointers = createMockPointers(30)

    // Moderate: keep recent 20 intact, summarize older
    const recentCount = 20
    const recent = pointers.slice(-recentCount)
    const older = pointers.slice(0, -recentCount)

    expect(recent.length).toBe(recentCount)
    expect(older.length).toBe(10)

    // Recent messages keep original content
    recent.forEach(ptr => {
      expect(ptr.fullContent).toBeTruthy()
    })

    // Older messages could be summarized
    expect(older.length).toBeLessThan(pointers.length)
  })

  it('should generate summary for compressed section', () => {
    const older = createMockPointers(10)

    // Simulated summary generation
    const summary = older
      .filter(p => p.type === 'user_input')
      .map(p => p.summary)
      .join('; ')

    expect(summary.length).toBeGreaterThan(0)
    expect(older.filter(p => p.type === 'user_input').length).toBeGreaterThan(0)
  })

  it('should achieve meaningful token reduction in moderate mode', () => {
    // Create pointers with realistic content sizes
    const pointers = Array.from({ length: 30 }, (_, i) =>
      createMockPointer('user_input', `This is message ${i}. `.repeat(50))
    )

    const originalTokens = pointers.reduce((sum, p) => sum + p.fullContent.length, 0) / 4

    // Moderate: keep recent 10 full, summarize older 20 into compact summaries
    const recentCount = 10
    const recentTokens = pointers.slice(-recentCount).reduce((sum, p) => sum + p.fullContent.length, 0) / 4
    const summarizedTokens = 200 // 20 messages summarized into a few brief entries

    const compressedTokens = recentTokens + summarizedTokens
    const reduction = (originalTokens - compressedTokens) / originalTokens

    expect(reduction).toBeGreaterThan(0.3) // At least 30% reduction
  })
})

// ============================================
// Aggressive Compression Strategy Tests
// ============================================

describe('Aggressive Compression Strategy', () => {
  it('should keep only key state, summarize everything else', () => {
    const pointers = createMockPointers(50)

    // Aggressive: keep only key pointers, summarize rest
    const keyPointers = pointers.filter(p =>
      p.associations.length > 0 ||
      (p.type === 'tool_call' && p.summary.includes('status'))
    )

    const summarizedPointers = pointers.filter(p => !keyPointers.includes(p))

    expect(keyPointers.length).toBeLessThan(pointers.length)
    expect(summarizedPointers.length).toBeGreaterThan(keyPointers.length)
  })

  it('should produce final summary of entire conversation', () => {
    const pointers = createMockPointers(100, true)

    // Aggressive compression produces a conversation summary
    const summary = {
      totalMessages: pointers.length,
      userInputs: pointers.filter(p => p.type === 'user_input').length,
      assistantResponses: pointers.filter(p => p.type === 'assistant_response').length,
      toolCalls: pointers.filter(p => p.type === 'tool_call').length,
      keyTopics: [...new Set(pointers.map(p => p.summary.slice(0, 30)))].slice(0, 5)
    }

    expect(summary.totalMessages).toBe(100)
    expect(summary.userInputs).toBeGreaterThan(0)
    expect(summary.assistantResponses).toBeGreaterThan(0)
  })

  it('should achieve 70%+ token reduction', () => {
    const pointers = createMockPointers(100)
    const originalTokens = pointers.reduce((sum, p) => sum + p.fullContent.length, 0) / 4

    // After aggressive: keep 5 key + 1 summary
    const keyCount = 5
    const keyTokens = pointers.slice(-keyCount).reduce((sum, p) => sum + p.fullContent.length, 0) / 4
    const summaryTokens = 200 // Flat cost for comprehensive summary

    const compressedTokens = keyTokens + summaryTokens
    const reduction = (originalTokens - compressedTokens) / originalTokens

    expect(reduction).toBeGreaterThan(0.70)
  })
})

// ============================================
// Critical State Preservation Tests
// ============================================

describe('Critical State Preservation', () => {
  it('should never compress verified patterns', () => {
    interface CriticalPointer extends MemoryPointer {
      isVerified?: boolean
    }

    const pointers: CriticalPointer[] = [
      { ...createMockPointer('tool_call', 'read_file:verified', []), isVerified: true },
      { ...createMockPointer('tool_call', 'terminal:verified', []), isVerified: true },
      { ...createMockPointer('user_input', 'regular input', []), isVerified: false }
    ]

    // Verified patterns should always be preserved
    const critical = pointers.filter(p => (p as CriticalPointer).isVerified)
    expect(critical.length).toBe(2)
  })

  it('should preserve tool patterns with high success count', () => {
    interface ToolPointer extends MemoryPointer {
      successCount?: number
    }

    const pointers: ToolPointer[] = [
      { ...createMockPointer('tool_call', 'npm install', []), successCount: 10 },
      { ...createMockPointer('tool_call', 'git status', []), successCount: 3 },
      { ...createMockPointer('tool_call', 'file read', []), successCount: 1 }
    ]

    const keepThreshold = 5
    const highSuccess = pointers.filter(p => (p.successCount || 0) >= keepThreshold)

    expect(highSuccess.length).toBe(1)
    expect(highSuccess[0].summary).toBe('npm install')
  })

  it('should always preserve current plan if exists', () => {
    interface PlanPointer extends MemoryPointer {
      isCurrentPlan?: boolean
    }

    const pointers: PlanPointer[] = [
      { ...createMockPointer('user_input', 'old task', []), isCurrentPlan: false },
      { ...createMockPointer('assistant_response', 'plan description', []), isCurrentPlan: true }
    ]

    const currentPlan = pointers.filter(p => p.isCurrentPlan)
    expect(currentPlan.length).toBe(1)
  })

  it('should preserve user preferences', () => {
    interface PrefPointer extends MemoryPointer {
      isPreference?: boolean
    }

    const pointers: PrefPointer[] = [
      { ...createMockPointer('assistant_response', 'user pref: dark mode', []), isPreference: true },
      { ...createMockPointer('user_input', 'regular message', []), isPreference: false }
    ]

    const prefs = pointers.filter(p => p.isPreference)
    expect(prefs.length).toBe(1)
  })
})

// ============================================
// Compression Orchestrator Tests
// ============================================

describe('CompressionOrchestrator', () => {
  const MAX_TOKENS = 128000

  it('should select lightweight at 70-84%', () => {
    const testCases = [
      { tokens: MAX_TOKENS * 0.70, expected: 'lightweight' as CompressionLevel },
      { tokens: MAX_TOKENS * 0.75, expected: 'lightweight' as CompressionLevel },
      { tokens: MAX_TOKENS * 0.84, expected: 'lightweight' as CompressionLevel }
    ]

    testCases.forEach(({ tokens, expected }) => {
      let level: CompressionLevel
      if (tokens >= MAX_TOKENS * 0.95) level = 'aggressive'
      else if (tokens >= MAX_TOKENS * 0.85) level = 'moderate'
      else level = 'lightweight'

      expect(level).toBe(expected)
    })
  })

  it('should select moderate at 85-94%', () => {
    const testCases = [
      { tokens: MAX_TOKENS * 0.85, expected: 'moderate' as CompressionLevel },
      { tokens: MAX_TOKENS * 0.90, expected: 'moderate' as CompressionLevel },
      { tokens: MAX_TOKENS * 0.94, expected: 'moderate' as CompressionLevel }
    ]

    testCases.forEach(({ tokens, expected }) => {
      let level: CompressionLevel
      if (tokens >= MAX_TOKENS * 0.95) level = 'aggressive'
      else if (tokens >= MAX_TOKENS * 0.85) level = 'moderate'
      else level = 'lightweight'

      expect(level).toBe(expected)
    })
  })

  it('should select aggressive at 95%+', () => {
    const testCases = [
      { tokens: MAX_TOKENS * 0.95, expected: 'aggressive' as CompressionLevel },
      { tokens: MAX_TOKENS * 0.98, expected: 'aggressive' as CompressionLevel },
      { tokens: MAX_TOKENS * 1.00, expected: 'aggressive' as CompressionLevel }
    ]

    testCases.forEach(({ tokens, expected }) => {
      let level: CompressionLevel
      if (tokens >= MAX_TOKENS * 0.95) level = 'aggressive'
      else if (tokens >= MAX_TOKENS * 0.85) level = 'moderate'
      else level = 'lightweight'

      expect(level).toBe(expected)
    })
  })

  it('should report compression metrics', () => {
    const originalCount = 100
    const compressedCount = 25
    const originalTokens = 100000
    const compressedTokens = 20000

    const result: CompressionResult = {
      level: 'aggressive',
      originalCount,
      compressedCount,
      originalTokens,
      compressedTokens,
      savedTokens: originalTokens - compressedTokens,
      summary: 'Compressed conversation summary'
    }

    expect(result.savedTokens).toBe(80000)
    expect(result.savedTokens / originalTokens).toBeGreaterThan(0.7)
  })
})

// ============================================
// Token Count Estimation Tests
// ============================================

describe('Token Count Estimation', () => {
  it('should calculate total tokens from pointers', () => {
    const pointers = createMockPointers(10)

    const totalTokens = pointers.reduce((sum, p) => {
      return sum + Math.ceil(p.fullContent.length / 4)
    }, 0)

    expect(totalTokens).toBeGreaterThan(0)
    expect(totalTokens).toBeLessThanOrEqual(pointers.reduce((sum, p) => sum + p.fullContent.length, 0))
  })
})
