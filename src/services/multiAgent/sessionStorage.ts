/**
 * Collaboration Session Storage - IndexedDB-backed persistence
 * Replaces localStorage with IndexedDB for better crash recovery
 */

import { createIndexedDBStorage, type IndexedDBStorage } from '../storage/indexedDBStorage'
import type { CollaborationSession, AgentInstance, AgentOutput } from './types'

const DB_NAME = 'harness_collaboration'
const STORE_NAME = 'sessions'
const STORAGE_KEY = 'harness_collaboration_sessions'

let storageInstance: IndexedDBStorage | null = null

function getStorage(): IndexedDBStorage {
  if (!storageInstance) {
    storageInstance = createIndexedDBStorage(DB_NAME, STORE_NAME)
  }
  return storageInstance
}

export interface SerializedSession {
  id: string
  name: string
  description?: string
  status: string
  agents: [string, AgentInstance][]
  tasks: Array<{
    id: string
    description: string
    assignedAgent?: string
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed'
    dependencies: string[]
    result?: AgentOutput
    createdAt: number
    startedAt?: number
    completedAt?: number
  }>
  results: [string, AgentOutput][]
  createdAt: number
  updatedAt: number
  completedAt?: number
}

export async function saveSessions(sessions: Map<string, CollaborationSession>): Promise<void> {
  const storage = getStorage()
  const sessionsData: SerializedSession[] = Array.from(sessions.values()).map(session => ({
    id: session.id,
    name: session.name,
    description: session.description,
    status: session.status,
    agents: Array.from(session.agents.entries()),
    tasks: session.tasks.map(task => ({
      id: task.id,
      description: task.description,
      assignedAgent: task.assignedAgent,
      status: task.status,
      dependencies: task.dependencies,
      result: task.result,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt
    })),
    results: Array.from(session.results.entries()),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    completedAt: session.completedAt
  }))
  
  await storage.set(STORAGE_KEY, sessionsData)
}

export async function loadSessions(): Promise<SerializedSession[] | null> {
  const storage = getStorage()
  const data = await storage.get<SerializedSession[]>(STORAGE_KEY)
  return data
}

export async function clearSessions(): Promise<void> {
  const storage = getStorage()
  await storage.delete(STORAGE_KEY)
}