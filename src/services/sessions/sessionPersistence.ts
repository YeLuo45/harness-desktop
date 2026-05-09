import type { Session } from './types'

const SESSIONS_KEY = 'harness_sessions'
const ACTIVE_SESSION_KEY = 'harness_active_session'

/**
 * SessionPersistence - handles session persistence to localStorage
 * Uses the same storage infrastructure as P2's LongTermMemoryService
 */
export class SessionPersistence {
  private storage: Storage

  constructor() {
    // Use localStorage for session persistence
    this.storage = localStorage
  }

  /**
   * Save all sessions to storage
   */
  async saveSessions(sessions: Session[], activeId: string | null): Promise<void> {
    try {
      const data = {
        sessions,
        activeId,
        savedAt: Date.now()
      }
      this.storage.setItem(SESSIONS_KEY, JSON.stringify(data))
      console.log(`[SessionPersistence] Saved ${sessions.length} sessions, active: ${activeId}`)
    } catch (error) {
      console.error('[SessionPersistence] Failed to save sessions:', error)
      throw error
    }
  }

  /**
   * Load sessions from storage
   */
  async loadSessions(): Promise<{ sessions: Session[]; activeId: string | null }> {
    try {
      const raw = this.storage.getItem(SESSIONS_KEY)
      if (!raw) {
        console.log('[SessionPersistence] No saved sessions found')
        return { sessions: [], activeId: null }
      }

      const data = JSON.parse(raw) as {
        sessions: Session[]
        activeId: string | null
        savedAt: number
      }

      console.log(`[SessionPersistence] Loaded ${data.sessions.length} sessions, active: ${data.activeId}`)
      return {
        sessions: data.sessions,
        activeId: data.activeId
      }
    } catch (error) {
      console.error('[SessionPersistence] Failed to load sessions:', error)
      return { sessions: [], activeId: null }
    }
  }

  /**
   * Clear all persisted sessions
   */
  async clear(): Promise<void> {
    try {
      this.storage.removeItem(SESSIONS_KEY)
      this.storage.removeItem(ACTIVE_SESSION_KEY)
      console.log('[SessionPersistence] Cleared all sessions')
    } catch (error) {
      console.error('[SessionPersistence] Failed to clear sessions:', error)
      throw error
    }
  }

  /**
   * Save a single session (partial update)
   */
  async saveSession(session: Session): Promise<void> {
    const { sessions, activeId } = await this.loadSessions()
    const index = sessions.findIndex(s => s.id === session.id)

    if (index >= 0) {
      sessions[index] = session
    } else {
      sessions.push(session)
    }

    await this.saveSessions(sessions, activeId)
  }

  /**
   * Delete a single session from storage
   */
  async deleteSession(id: string): Promise<void> {
    const { sessions, activeId } = await this.loadSessions()
    const filtered = sessions.filter(s => s.id !== id)
    const newActiveId = activeId === id ? null : activeId
    await this.saveSessions(filtered, newActiveId)
  }
}

// Singleton instance
let persistenceInstance: SessionPersistence | null = null

export function getSessionPersistence(): SessionPersistence {
  if (!persistenceInstance) {
    persistenceInstance = new SessionPersistence()
  }
  return persistenceInstance
}
