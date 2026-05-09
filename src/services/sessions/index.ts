// Session types and utilities
export * from './types'

// SessionManager - session lifecycle management
export { SessionManager, getSessionManager, initSessionManager } from './sessionManager'

// SessionPersistence - IndexedDB persistence
export { SessionPersistence, getSessionPersistence } from './sessionPersistence'

import { getSessionManager } from './sessionManager'
import { getSessionPersistence } from './sessionPersistence'
import { initSessionManager } from './sessionManager'

/**
 * Initialize session system with persistence
 * Call this on app startup to restore sessions
 */
export async function initSessionSystem(): Promise<void> {
  const persistence = getSessionPersistence()

  // Try to restore sessions from storage
  try {
    const { sessions, activeId } = await persistence.loadSessions()

    if (sessions.length > 0) {
      // Initialize manager without default session, then restore
      const manager = initSessionManager()
      manager.restore(sessions, activeId)

      console.log(`[SessionSystem] Restored ${sessions.length} sessions`)
    } else {
      // No saved sessions, initialize with default
      initSessionManager()
      console.log('[SessionSystem] No saved sessions found, initialized with default')
    }
  } catch (error) {
    console.warn('[SessionSystem] Failed to restore sessions, starting fresh:', error)
    initSessionManager()
  }
}

/**
 * Save current session state
 * Call periodically or on page unload
 */
export async function saveSessionState(): Promise<void> {
  const persistence = getSessionPersistence()
  const { getSessionManager } = await import('./sessionManager')

  const manager = getSessionManager()
  const sessions = manager.listAll()
  const activeId = manager.getActiveId()

  await persistence.saveSessions(sessions, activeId)
}
