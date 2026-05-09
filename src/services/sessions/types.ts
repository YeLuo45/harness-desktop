import type { MemoryPointer } from '../../types'

/**
 * Session metadata - information about the session
 */
export interface SessionMetadata {
  model?: string
  provider?: string
  messageCount: number
  lastMessageAt?: number
}

/**
 * Session - represents a chat session with its own context
 */
export interface Session {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  context: MemoryPointer[]
  metadata: SessionMetadata
  isActive: boolean
}

/**
 * Session list item - lightweight info for UI
 */
export interface SessionListItem {
  id: string
  name: string
  updatedAt: number
  isActive: boolean
  messageCount: number
  preview?: string
}

/**
 * Create a new session with defaults
 */
export function createSession(name: string, overrides?: Partial<Session>): Session {
  const now = Date.now()
  return {
    id: `session-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    updatedAt: now,
    context: [],
    metadata: {
      messageCount: 0,
      ...overrides?.metadata
    },
    isActive: false,
    ...overrides
  }
}

/**
 * Update session timestamp
 */
export function touchSession(session: Session): Session {
  return {
    ...session,
    updatedAt: Date.now()
  }
}

/**
 * Get lightweight list item from session
 */
export function toSessionListItem(session: Session): SessionListItem {
  return {
    id: session.id,
    name: session.name,
    updatedAt: session.updatedAt,
    isActive: session.isActive,
    messageCount: session.metadata.messageCount,
    preview: session.context[session.context.length - 1]?.summary
  }
}

/**
 * Format relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (diff < 0) return 'Just now'
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

/**
 * Truncate session name for display
 */
export function truncateSessionName(name: string, maxLength = 30): string {
  if (name.length <= maxLength) return name
  return name.slice(0, maxLength - 3) + '...'
}
