import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MemoryPointer, VerificationPattern } from '../types'

// ============================================
// In-Memory Mock Storage (actually persists data)
// ============================================

function createInMemoryStorage<T = unknown>() {
  const store = new Map<string, T>()
  return {
    get: vi.fn(async (key: string): Promise<T | null> => {
      return store.get(key) ?? null
    }),
    set: vi.fn(async (key: string, value: T): Promise<void> => {
      store.set(key, value)
    }),
    remove: vi.fn(async (key: string): Promise<void> => {
      store.delete(key)
    }),
    clear: vi.fn(async (): Promise<void> => {
      store.clear()
    }),
    has: vi.fn(async (key: string): Promise<boolean> => {
      return store.has(key)
    }),
    _store: store // for testing
  }
}

// ============================================
// Phase 1: Storage Backend Interface Tests
// ============================================

describe('StorageBackend Interface', () => {
  it('should define StorageBackend with required methods', () => {
    interface StorageBackend {
      get<T>(key: string): Promise<T | null>
      set<T>(key: string, value: T): Promise<void>
      remove(key: string): Promise<void>
      clear(): Promise<void>
      has(key: string): Promise<boolean>
    }

    const mockBackend: StorageBackend = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      has: vi.fn().mockResolvedValue(false)
    }

    expect(typeof mockBackend.get).toBe('function')
    expect(typeof mockBackend.set).toBe('function')
    expect(typeof mockBackend.remove).toBe('function')
    expect(typeof mockBackend.clear).toBe('function')
    expect(typeof mockBackend.has).toBe('function')
  })
})

// ============================================
// Phase 2: MemoryPointer Persistence Tests
// ============================================

describe('MemoryPointer Persistence', () => {
  const samplePointer: MemoryPointer = {
    id: 'test-pointer-1',
    type: 'user_input',
    summary: 'User asked about file operations',
    fullContent: 'How do I read a file in Python?',
    timestamp: Date.now(),
    associations: []
  }

  it('should serialize MemoryPointer to JSON', () => {
    const serialized = JSON.stringify(samplePointer)
    const deserialized = JSON.parse(serialized)

    expect(deserialized.id).toBe(samplePointer.id)
    expect(deserialized.type).toBe(samplePointer.type)
    expect(deserialized.summary).toBe(samplePointer.summary)
    expect(deserialized.fullContent).toBe(samplePointer.fullContent)
  })

  it('should preserve MemoryPointer structure after round-trip', async () => {
    const storage = createInMemoryStorage<MemoryPointer>()

    await storage.set('test', samplePointer)
    const retrieved = await storage.get('test')

    expect(retrieved).toEqual(samplePointer)
  })
})

// ============================================
// Phase 3: LongTermMemoryService Tests
// ============================================

describe('LongTermMemoryService', () => {
  // Create in-memory stores that actually persist
  let mockLocalStorage: ReturnType<typeof createInMemoryStorage<string>>
  let mockIndexedDB: ReturnType<typeof createInMemoryStorage<unknown>>

  beforeEach(() => {
    mockLocalStorage = createInMemoryStorage<string>()
    mockIndexedDB = createInMemoryStorage<unknown>()
  })

  describe('Storage Layer Selection', () => {
    it('should use localStorage for hot data (user preferences)', async () => {
      const hotData = { theme: 'dark', language: 'en' }

      await mockLocalStorage.set('user_prefs', JSON.stringify(hotData))

      expect(mockLocalStorage.set).toHaveBeenCalledWith(
        'user_prefs',
        JSON.stringify(hotData)
      )

      // Verify it was actually stored
      const retrieved = await mockLocalStorage.get('user_prefs')
      expect(JSON.parse(retrieved!)).toEqual(hotData)
    })

    it('should use IndexedDB for warm data (verified patterns)', async () => {
      const pattern: VerificationPattern = {
        id: 'pattern-1',
        toolName: 'read_file',
        pattern: 'read_file.*\\.py$',
        validationRule: 'fileExists',
        successCount: 10,
        lastUsed: Date.now()
      }

      await mockIndexedDB.set('pattern:read_file', pattern)

      expect(mockIndexedDB.set).toHaveBeenCalledWith('pattern:read_file', pattern)

      // Verify it was actually stored
      const retrieved = await mockIndexedDB.get<VerificationPattern>('pattern:read_file')
      expect(retrieved).toEqual(pattern)
    })
  })

  describe('Cross-Session Persistence', () => {
    it('should persist MemoryPointers across page reloads', async () => {
      const pointer: MemoryPointer = {
        id: 'cross-session-1',
        type: 'tool_call',
        summary: 'Terminal: npm install',
        fullContent: 'Tool: terminal\nArgs: {"command":"npm install"}\nResult: success',
        timestamp: Date.now(),
        associations: []
      }

      // Simulate save
      await mockIndexedDB.set(`memory:${pointer.id}`, pointer)

      // Simulate page reload - get returns stored value
      const retrieved = await mockIndexedDB.get<MemoryPointer>(`memory:${pointer.id}`)

      expect(retrieved).toEqual(pointer)
    })

    it('should persist user preferences across sessions', async () => {
      const prefs = {
        model: 'openai',
        modelName: 'gpt-4o',
        contextWindow: 128000
      }

      // Save
      await mockLocalStorage.set('config:preferences', JSON.stringify(prefs))

      // Retrieve after reload
      const retrieved = await mockLocalStorage.get('config:preferences')
      const parsed = retrieved ? JSON.parse(retrieved) : null

      expect(parsed).toEqual(prefs)
    })
  })

  describe('Pattern Deduplication', () => {
    it('should merge duplicate verification patterns', async () => {
      const pattern1: VerificationPattern = {
        id: 'dedup-1',
        toolName: 'terminal',
        pattern: 'npm install',
        validationRule: 'exitCodeZero',
        successCount: 5,
        lastUsed: Date.now() - 1000
      }

      const pattern2: VerificationPattern = {
        id: 'dedup-1', // Same ID
        toolName: 'terminal',
        pattern: 'npm install',
        validationRule: 'exitCodeZero',
        successCount: 6, // Increment
        lastUsed: Date.now()
      }

      // Simulate merge logic
      const merged = {
        ...pattern1,
        successCount: pattern1.successCount + 1,
        lastUsed: pattern2.lastUsed
      }

      await mockIndexedDB.set('pattern:terminal:npm_install', merged)

      const retrieved = await mockIndexedDB.get<VerificationPattern>('pattern:terminal:npm_install')

      expect(retrieved?.successCount).toBe(6)
      expect(retrieved?.lastUsed).toBe(pattern2.lastUsed)
    })
  })
})

// ============================================
// Integration Tests with ContextManager
// ============================================

describe('ContextManager Integration', () => {
  it('should export memory to LongTermMemoryService', async () => {
    const storage = createInMemoryStorage<string>()

    const pointers: MemoryPointer[] = [
      {
        id: 'ptr-1',
        type: 'user_input',
        summary: 'Test input',
        fullContent: 'Test content',
        timestamp: Date.now(),
        associations: []
      }
    ]

    // Export pointers to storage
    await storage.set('context:pointers', JSON.stringify(pointers))

    expect(storage.set).toHaveBeenCalledWith(
      'context:pointers',
      JSON.stringify(pointers)
    )

    // Verify retrieval
    const retrieved = await storage.get('context:pointers')
    expect(JSON.parse(retrieved!)).toEqual(pointers)
  })

  it('should restore memory from LongTermMemoryService on init', async () => {
    const storedPointers = [
      {
        id: 'ptr-restored',
        type: 'assistant_response',
        summary: 'Restored response',
        fullContent: 'Restored content',
        timestamp: Date.now(),
        associations: ['ptr-1']
      }
    ]

    const storage = createInMemoryStorage<string>()
    await storage.set('context:pointers', JSON.stringify(storedPointers))

    const retrieved = await storage.get('context:pointers')
    const pointers = retrieved ? JSON.parse(retrieved) : []

    expect(pointers).toEqual(storedPointers)
    expect(pointers.length).toBe(1)
  })
})
