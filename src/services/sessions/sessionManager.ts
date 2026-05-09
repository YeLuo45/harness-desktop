import type { MemoryPointer } from '../../types'
import { createSession, touchSession, toSessionListItem, type Session, type SessionListItem } from './types'

/**
 * SessionManager - manages session lifecycle
 */
export class SessionManager {
  private sessions = new Map<string, Session>()
  private activeSessionId: string | null = null

  constructor(options?: { initDefault?: boolean }) {
    // Initialize with a default session unless explicitly skipped (for restore)
    if (options?.initDefault !== false) {
      const defaultSession = createSession('New Session')
      defaultSession.isActive = true
      this.sessions.set(defaultSession.id, defaultSession)
      this.activeSessionId = defaultSession.id
    }
  }

  /**
   * Restore sessions from persisted state
   */
  restore(sessions: Session[], activeId: string | null): void {
    this.sessions.clear()
    this.activeSessionId = null

    for (const session of sessions) {
      this.sessions.set(session.id, session)
    }

    // Set active
    if (activeId && this.sessions.has(activeId)) {
      this.activeSessionId = activeId
      const session = this.sessions.get(activeId)!
      session.isActive = true
    } else if (this.sessions.size > 0) {
      // Fallback to most recent
      const sorted = Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt)
      const mostRecent = sorted[0]
      mostRecent.isActive = true
      this.activeSessionId = mostRecent.id
    }

    console.log(`[SessionManager] Restored ${this.sessions.size} sessions, active: ${this.activeSessionId}`)
  }

  /**
   * Create a new session
   */
  create(name: string): Session {
    const session = createSession(name)
    this.sessions.set(session.id, session)
    console.log(`[SessionManager] Created session: ${session.id} "${name}"`)
    return session
  }

  /**
   * Get session by ID
   */
  get(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  /**
   * Switch to a session
   */
  switch(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) {
      console.warn(`[SessionManager] Session not found: ${id}`)
      return false
    }

    // Deactivate current
    if (this.activeSessionId) {
      const current = this.sessions.get(this.activeSessionId)
      if (current) {
        current.isActive = false
      }
    }

    // Activate new
    session.isActive = true
    session.updatedAt = Date.now()
    this.activeSessionId = id

    console.log(`[SessionManager] Switched to session: ${id}`)
    return true
  }

  /**
   * Get the active session
   */
  getActive(): Session | null {
    if (!this.activeSessionId) return null
    return this.sessions.get(this.activeSessionId) || null
  }

  /**
   * Get active session ID
   */
  getActiveId(): string | null {
    return this.activeSessionId
  }

  /**
   * List all sessions as lightweight items
   */
  list(): SessionListItem[] {
    return Array.from(this.sessions.values())
      .map(toSessionListItem)
      .sort((a, b) => b.updatedAt - a.updatedAt) // Most recent first
  }

  /**
   * List all sessions with full data
   */
  listAll(): Session[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * Delete a session
   */
  delete(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) {
      return false
    }

    const wasActive = session.isActive
    const deleted = this.sessions.delete(id)

    if (deleted && wasActive) {
      this.activeSessionId = null
      // Auto-switch to most recent remaining session
      const remaining = this.list()
      if (remaining.length > 0) {
        this.switch(remaining[0].id)
      }
    }

    console.log(`[SessionManager] Deleted session: ${id}`)
    return deleted
  }

  /**
   * Update session context
   */
  updateContext(id: string, context: MemoryPointer[]): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    session.context = context
    session.updatedAt = Date.now()
    return true
  }

  /**
   * Add a pointer to session context
   */
  addToContext(id: string, pointer: MemoryPointer): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    session.context.push(pointer)
    session.updatedAt = Date.now()
    session.metadata.messageCount++
    session.metadata.lastMessageAt = pointer.timestamp
    return true
  }

  /**
   * Update session metadata
   */
  updateMetadata(id: string, metadata: Partial<Session['metadata']>): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    session.metadata = { ...session.metadata, ...metadata }
    session.updatedAt = Date.now()
    return true
  }

  /**
   * Rename a session
   */
  rename(id: string, name: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    session.name = name
    session.updatedAt = Date.now()
    return true
  }

  /**
   * Clear all sessions
   */
  clear(): void {
    this.sessions.clear()
    this.activeSessionId = null
  }

  /**
   * Get session count
   */
  count(): number {
    return this.sessions.size
  }

  /**
   * Check if session exists
   */
  has(id: string): boolean {
    return this.sessions.has(id)
  }
}

// Singleton instance
let sessionManagerInstance: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager()
  }
  return sessionManagerInstance
}

export function initSessionManager(): SessionManager {
  sessionManagerInstance = new SessionManager()
  return sessionManagerInstance
}
