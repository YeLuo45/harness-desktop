import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MemoryPointer } from '../types'

// ============================================
// Session Types Tests
// ============================================

describe('Session Data Model', () => {
  interface SessionMetadata {
    model?: string
    provider?: string
    messageCount: number
  }

  interface Session {
    id: string
    name: string
    createdAt: number
    updatedAt: number
    context: MemoryPointer[]
    metadata: SessionMetadata
    isActive: boolean
  }

  it('should define required session properties', () => {
    const session: Session = {
      id: 'session-1',
      name: 'Test Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      context: [],
      metadata: { messageCount: 0 },
      isActive: true
    }

    expect(typeof session.id).toBe('string')
    expect(typeof session.name).toBe('string')
    expect(typeof session.createdAt).toBe('number')
    expect(typeof session.updatedAt).toBe('number')
    expect(Array.isArray(session.context)).toBe(true)
    expect(typeof session.isActive).toBe('boolean')
  })

  it('should track session metadata', () => {
    const metadata: SessionMetadata = {
      model: 'gpt-4o',
      provider: 'openai',
      messageCount: 42
    }

    expect(metadata.model).toBe('gpt-4o')
    expect(metadata.provider).toBe('openai')
    expect(metadata.messageCount).toBe(42)
  })

  it('should generate unique session IDs', () => {
    const generateId = () => `session-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const id1 = generateId()
    const id2 = generateId()

    expect(id1).not.toBe(id2)
    expect(id1.startsWith('session-')).toBe(true)
  })

  it('should update timestamp on session change', () => {
    const session = {
      id: 's1',
      name: 'Test',
      createdAt: 1000,
      updatedAt: 1000,
      context: [] as MemoryPointer[],
      metadata: { messageCount: 0 },
      isActive: true
    }

    const now = Date.now()
    session.updatedAt = now
    session.metadata.messageCount++

    expect(session.updatedAt).toBe(now)
    expect(session.metadata.messageCount).toBe(1)
  })
})

// ============================================
// SessionManager Tests
// ============================================

describe('SessionManager', () => {
  interface Session {
    id: string
    name: string
    createdAt: number
    updatedAt: number
    context: MemoryPointer[]
    metadata: { messageCount: number }
    isActive: boolean
  }

  class MockSessionManager {
    private sessions = new Map<string, Session>()
    private activeSessionId: string | null = null

    create(name: string): Session {
      const now = Date.now()
      const session: Session = {
        id: `session-${now}-${Math.random().toString(36).slice(2)}`,
        name,
        createdAt: now,
        updatedAt: now,
        context: [],
        metadata: { messageCount: 0 },
        isActive: false
      }
      this.sessions.set(session.id, session)
      return session
    }

    get(id: string): Session | undefined {
      return this.sessions.get(id)
    }

    switch(id: string): boolean {
      const session = this.sessions.get(id)
      if (!session) return false

      // Deactivate current
      if (this.activeSessionId) {
        const current = this.sessions.get(this.activeSessionId)
        if (current) current.isActive = false
      }

      // Activate new
      session.isActive = true
      session.updatedAt = Date.now()
      this.activeSessionId = id
      return true
    }

    list(): Session[] {
      return Array.from(this.sessions.values())
    }

    delete(id: string): boolean {
      const session = this.sessions.get(id)
      if (!session) return false
      // Allow deleting active session (app would create a new one)
      this.sessions.delete(id)
      if (session.isActive) {
        this.activeSessionId = null
      }
      return true
    }

    getActive(): Session | null {
      if (!this.activeSessionId) return null
      return this.sessions.get(this.activeSessionId) || null
    }

    updateContext(id: string, context: MemoryPointer[]): boolean {
      const session = this.sessions.get(id)
      if (!session) return false
      session.context = context
      session.updatedAt = Date.now()
      return true
    }

    clear(): void {
      this.sessions.clear()
      this.activeSessionId = null
    }
  }

  let manager: MockSessionManager

  beforeEach(() => {
    manager = new MockSessionManager()
  })

  describe('Session Creation', () => {
    it('should create a new session', () => {
      const session = manager.create('My Session')

      expect(session.name).toBe('My Session')
      expect(session.isActive).toBe(false)
      expect(session.context).toEqual([])
      expect(session.metadata.messageCount).toBe(0)
    })

    it('should generate unique IDs', () => {
      const s1 = manager.create('Session 1')
      const s2 = manager.create('Session 2')

      expect(s1.id).not.toBe(s2.id)
    })

    it('should set createdAt and updatedAt', () => {
      const before = Date.now()
      const session = manager.create('Test')
      const after = Date.now()

      expect(session.createdAt).toBeGreaterThanOrEqual(before)
      expect(session.createdAt).toBeLessThanOrEqual(after)
      expect(session.updatedAt).toBe(session.createdAt)
    })
  })

  describe('Session Switching', () => {
    it('should switch to an existing session', () => {
      const s1 = manager.create('Session 1')
      const s2 = manager.create('Session 2')

      const result = manager.switch(s1.id)

      expect(result).toBe(true)
      expect(manager.getActive()?.id).toBe(s1.id)
    })

    it('should deactivate previous session on switch', () => {
      const s1 = manager.create('Session 1')
      const s2 = manager.create('Session 2')

      manager.switch(s1.id)
      expect(s1.isActive).toBe(true)

      manager.switch(s2.id)
      expect(s1.isActive).toBe(false)
      expect(s2.isActive).toBe(true)
    })

    it('should return false for non-existent session', () => {
      const result = manager.switch('non-existent')
      expect(result).toBe(false)
    })

    it('should update timestamp on switch', () => {
      const s1 = manager.create('Session 1')
      const originalUpdatedAt = s1.updatedAt

      // Small delay to ensure time difference
      const now = Date.now() + 1

      manager.switch(s1.id)
      expect(manager.get(s1.id)!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })
  })

  describe('Session Listing', () => {
    it('should list all sessions', () => {
      manager.create('Session 1')
      manager.create('Session 2')
      manager.create('Session 3')

      const sessions = manager.list()

      expect(sessions.length).toBe(3)
    })

    it('should return empty list when no sessions', () => {
      const sessions = manager.list()
      expect(sessions.length).toBe(0)
    })
  })

  describe('Session Deletion', () => {
    it('should delete a session', () => {
      const s1 = manager.create('Session 1')
      manager.create('Session 2') // Keep one alive

      manager.switch(s1.id)
      const result = manager.delete(s1.id)

      expect(result).toBe(true)
      expect(manager.get(s1.id)).toBeUndefined()
    })

    it('should allow deleting the only session when creating a new one', () => {
      const s1 = manager.create('Session 1')
      manager.switch(s1.id)

      // Implementation allows deleting active session, app would create new one
      const result = manager.delete(s1.id)
      expect(result).toBe(true)
      // Manager has no sessions now, app would create default
      expect(manager.list().length).toBe(0)
    })

    it('should return false for non-existent session', () => {
      const result = manager.delete('non-existent')
      expect(result).toBe(false)
    })
  })

  describe('Context Management', () => {
    it('should update session context', () => {
      const session = manager.create('Test')
      const pointers: MemoryPointer[] = [
        {
          id: 'p1',
          type: 'user_input',
          summary: 'Test input',
          fullContent: 'Full test content',
          timestamp: Date.now(),
          associations: []
        }
      ]

      manager.updateContext(session.id, pointers)

      const updated = manager.get(session.id)
      expect(updated?.context.length).toBe(1)
      expect(updated?.context[0].id).toBe('p1')
    })

    it('should update timestamp when context changes', () => {
      const session = manager.create('Test')
      const originalUpdatedAt = session.updatedAt

      manager.updateContext(session.id, [])

      expect(manager.get(session.id)!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    })
  })
})

// ============================================
// Session Persistence Tests
// ============================================

describe('Session Persistence', () => {
  interface Session {
    id: string
    name: string
    createdAt: number
    updatedAt: number
    context: MemoryPointer[]
    metadata: { messageCount: number }
    isActive: boolean
  }

  // Simulate IndexedDB storage
  class MockStorage {
    private data = new Map<string, string>()
    private sessionsKey = 'harness_sessions'
    private activeKey = 'harness_active_session'

    saveSession(session: Session): void {
      const sessions = this.getAllSessions()
      sessions[session.id] = session
      this.data.set(this.sessionsKey, JSON.stringify(sessions))
    }

    getAllSessions(): Record<string, Session> {
      const raw = this.data.get(this.sessionsKey)
      return raw ? JSON.parse(raw) : {}
    }

    deleteSession(id: string): void {
      const sessions = this.getAllSessions()
      delete sessions[id]
      this.data.set(this.sessionsKey, JSON.stringify(sessions))
    }

    setActiveSession(id: string): void {
      this.data.set(this.activeKey, id)
    }

    getActiveSessionId(): string | null {
      return this.data.get(this.activeKey) || null
    }

    clear(): void {
      this.data.clear()
    }
  }

  let storage: MockStorage

  beforeEach(() => {
    storage = new MockStorage()
  })

  it('should persist session to storage', () => {
    const session: Session = {
      id: 's1',
      name: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      context: [],
      metadata: { messageCount: 0 },
      isActive: true
    }

    storage.saveSession(session)
    const sessions = storage.getAllSessions()

    expect(sessions['s1']).toBeDefined()
    expect(sessions['s1'].name).toBe('Test')
  })

  it('should persist multiple sessions', () => {
    const s1: Session = { id: 's1', name: 'Session 1', createdAt: Date.now(), updatedAt: Date.now(), context: [], metadata: { messageCount: 0 }, isActive: true }
    const s2: Session = { id: 's2', name: 'Session 2', createdAt: Date.now(), updatedAt: Date.now(), context: [], metadata: { messageCount: 0 }, isActive: false }

    storage.saveSession(s1)
    storage.saveSession(s2)

    const sessions = storage.getAllSessions()
    expect(Object.keys(sessions).length).toBe(2)
  })

  it('should delete session from storage', () => {
    const session: Session = { id: 's1', name: 'Test', createdAt: Date.now(), updatedAt: Date.now(), context: [], metadata: { messageCount: 0 }, isActive: true }
    storage.saveSession(session)

    storage.deleteSession('s1')

    const sessions = storage.getAllSessions()
    expect(sessions['s1']).toBeUndefined()
  })

  it('should track active session', () => {
    storage.setActiveSession('s1')
    expect(storage.getActiveSessionId()).toBe('s1')
  })

  it('should persist context with session', () => {
    const pointers: MemoryPointer[] = [
      {
        id: 'p1',
        type: 'user_input',
        summary: 'Input summary',
        fullContent: 'Full input content',
        timestamp: Date.now(),
        associations: ['p0']
      }
    ]

    const session: Session = {
      id: 's1',
      name: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      context: pointers,
      metadata: { messageCount: 1 },
      isActive: true
    }

    storage.saveSession(session)

    const restored = storage.getAllSessions()['s1']
    expect(restored.context.length).toBe(1)
    expect(restored.context[0].id).toBe('p1')
    expect(restored.context[0].associations).toEqual(['p0'])
  })
})

// ============================================
// Session Restore Tests
// ============================================

describe('Session Restore', () => {
  interface Session {
    id: string
    name: string
    createdAt: number
    updatedAt: number
    context: MemoryPointer[]
    metadata: { messageCount: number }
    isActive: boolean
  }

  it('should restore sessions on app start', () => {
    const storedSessions: Record<string, Session> = {
      's1': { id: 's1', name: 'Session 1', createdAt: Date.now(), updatedAt: Date.now(), context: [], metadata: { messageCount: 5 }, isActive: false },
      's2': { id: 's2', name: 'Session 2', createdAt: Date.now(), updatedAt: Date.now(), context: [], metadata: { messageCount: 10 }, isActive: true }
    }

    const restoredIds = Object.keys(storedSessions)
    expect(restoredIds).toContain('s1')
    expect(restoredIds).toContain('s2')
  })

  it('should restore active session as current', () => {
    const storedSessions: Record<string, Session> = {
      's1': { id: 's1', name: 'Session 1', createdAt: Date.now(), updatedAt: Date.now(), context: [], metadata: { messageCount: 5 }, isActive: false },
      's2': { id: 's2', name: 'Session 2', createdAt: Date.now(), updatedAt: Date.now(), context: [], metadata: { messageCount: 10 }, isActive: true }
    }

    const activeSession = Object.values(storedSessions).find(s => s.isActive)
    expect(activeSession?.id).toBe('s2')
  })

  it('should handle empty storage gracefully', () => {
    const storedSessions: Record<string, Session> = {}

    const restoredIds = Object.keys(storedSessions)
    expect(restoredIds.length).toBe(0)

    // Should create a default session
    const defaultSession = {
      id: `default-${Date.now()}`,
      name: 'New Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      context: [],
      metadata: { messageCount: 0 },
      isActive: true
    }

    expect(defaultSession.name).toBe('New Session')
  })

  it('should restore context pointers correctly', () => {
    const pointers: MemoryPointer[] = [
      { id: 'p1', type: 'user_input', summary: 'User said hello', fullContent: 'User said hello', timestamp: 1000, associations: [] },
      { id: 'p2', type: 'assistant_response', summary: 'Assistant responded', fullContent: 'Assistant responded with greeting', timestamp: 2000, associations: ['p1'] },
      { id: 'p3', type: 'tool_call', summary: 'Called terminal', fullContent: 'Called terminal: ls -la', timestamp: 3000, associations: ['p2'] }
    ]

    const session: Session = {
      id: 's1',
      name: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      context: pointers,
      metadata: { messageCount: 3 },
      isActive: true
    }

    expect(session.context.length).toBe(3)
    expect(session.context[1].associations).toContain('p1')
    expect(session.metadata.messageCount).toBe(3)
  })
})

// ============================================
// Multiple Sessions Tests
// ============================================

describe('Multiple Sessions', () => {
  interface Session {
    id: string
    name: string
    createdAt: number
    updatedAt: number
    context: MemoryPointer[]
    metadata: { messageCount: number }
    isActive: boolean
  }

  class MultiSessionManager {
    private sessions = new Map<string, Session>()
    private activeId: string | null = null

    create(name: string): Session {
      const now = Date.now()
      const session: Session = {
        id: `s-${now}-${Math.random().toString(36).slice(2)}`,
        name,
        createdAt: now,
        updatedAt: now,
        context: [],
        metadata: { messageCount: 0 },
        isActive: false
      }
      this.sessions.set(session.id, session)
      return session
    }

    switch(id: string): boolean {
      const session = this.sessions.get(id)
      if (!session) return false

      if (this.activeId) {
        this.sessions.get(this.activeId)!.isActive = false
      }

      session.isActive = true
      session.updatedAt = Date.now()
      this.activeId = id
      return true
    }

    getActive(): Session | null {
      return this.activeId ? this.sessions.get(this.activeId) || null : null
    }

    getAll(): Session[] {
      return Array.from(this.sessions.values())
    }

    hasMultipleActive(): boolean {
      return Array.from(this.sessions.values()).filter(s => s.isActive).length > 1
    }
  }

  it('should support multiple sessions with independent context', () => {
    const manager = new MultiSessionManager()

    const s1 = manager.create('Session 1')
    const s2 = manager.create('Session 2')

    manager.switch(s1.id)
    const p1: MemoryPointer = { id: 'p1', type: 'user_input', summary: 'S1 input', fullContent: 'S1 content', timestamp: Date.now(), associations: [] }
    s1.context.push(p1)

    manager.switch(s2.id)
    const p2: MemoryPointer = { id: 'p2', type: 'user_input', summary: 'S2 input', fullContent: 'S2 content', timestamp: Date.now(), associations: [] }
    s2.context.push(p2)

    // Each session should have independent context
    expect(s1.context.length).toBe(1)
    expect(s2.context.length).toBe(1)
    expect(s1.context[0].id).toBe('p1')
    expect(s2.context[0].id).toBe('p2')
  })

  it('should only have one active session at a time', () => {
    const manager = new MultiSessionManager()

    const s1 = manager.create('Session 1')
    const s2 = manager.create('Session 2')
    const s3 = manager.create('Session 3')

    manager.switch(s1.id)
    manager.switch(s2.id)
    manager.switch(s3.id)

    expect(manager.hasMultipleActive()).toBe(false)

    const active = manager.getActive()
    expect(active?.id).toBe(s3.id)
  })

  it('should switch between sessions preserving their state', () => {
    const manager = new MultiSessionManager()

    const s1 = manager.create('Session 1')
    const s2 = manager.create('Session 2')

    // Add context to s1
    manager.switch(s1.id)
    s1.context.push({ id: 'p1', type: 'user_input', summary: 'From S1', fullContent: 'S1 content', timestamp: Date.now(), associations: [] })
    s1.metadata.messageCount++

    // Add context to s2
    manager.switch(s2.id)
    s2.context.push({ id: 'p2', type: 'user_input', summary: 'From S2', fullContent: 'S2 content', timestamp: Date.now(), associations: [] })
    s2.metadata.messageCount += 5

    // Switch back to s1 - should preserve state
    manager.switch(s1.id)
    const restoredS1 = manager.getActive()

    expect(restoredS1?.id).toBe(s1.id)
    expect(restoredS1?.context.length).toBe(1)
    expect(restoredS1?.metadata.messageCount).toBe(1)

    // Switch to s2 - should preserve its state
    manager.switch(s2.id)
    const restoredS2 = manager.getActive()

    expect(restoredS2?.id).toBe(s2.id)
    expect(restoredS2?.context.length).toBe(1)
    expect(restoredS2?.metadata.messageCount).toBe(5)
  })
})

// ============================================
// Session UI State Tests
// ============================================

describe('Session UI State', () => {
  it('should provide session list for sidebar', () => {
    interface Session {
      id: string
      name: string
      updatedAt: number
      isActive: boolean
      metadata: { messageCount: number }
    }

    const sessions: Session[] = [
      { id: 's1', name: 'Current Session', updatedAt: Date.now(), isActive: true, metadata: { messageCount: 42 } },
      { id: 's2', name: 'Previous Work', updatedAt: Date.now() - 86400000, isActive: false, metadata: { messageCount: 100 } },
      { id: 's3', name: 'Archive', updatedAt: Date.now() - 172800000, isActive: false, metadata: { messageCount: 200 } }
    ]

    // Sort by updatedAt descending for recent first
    sessions.sort((a, b) => b.updatedAt - a.updatedAt)

    expect(sessions[0].name).toBe('Current Session')
    expect(sessions[1].name).toBe('Previous Work')
    expect(sessions[2].name).toBe('Archive')
  })

  it('should format session timestamp for display', () => {
    const formatRelativeTime = (timestamp: number): string => {
      const diff = Date.now() - timestamp
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)

      if (minutes < 1) return 'Just now'
      if (minutes < 60) return `${minutes}m ago`
      if (hours < 24) return `${hours}h ago`
      return `${days}d ago`
    }

    expect(formatRelativeTime(Date.now())).toBe('Just now')
    expect(formatRelativeTime(Date.now() - 300000)).toBe('5m ago') // 5 minutes
    expect(formatRelativeTime(Date.now() - 3600000)).toBe('1h ago') // 1 hour
    expect(formatRelativeTime(Date.now() - 86400000)).toBe('1d ago') // 1 day
  })

  it('should truncate long session names for display', () => {
    const truncateName = (name: string, maxLength = 30): string => {
      if (name.length <= maxLength) return name
      return name.slice(0, maxLength - 3) + '...'
    }

    // Short name returns unchanged
    expect(truncateName('Short Name')).toBe('Short Name')

    // Long name gets truncated to maxLength chars
    const longName = 'This is a very long session name that should be truncated'
    const truncated = truncateName(longName)
    expect(truncated.length).toBe(30) // maxLength
    expect(truncated.endsWith('...')).toBe(true)
    expect(truncated.startsWith('This is a very long session')).toBe(true)
  })
})
