/**
 * Persistence Layer Types
 * 
 * Common types for the persistence subsystem including delegation state,
 * cron tasks, and generic file storage with atomic write support.
 */

import type { ScheduledTask, TaskExecution, TaskStatus } from '../scheduler/types'

// ============================================================================
// Delegation State Types
// ============================================================================

export type DelegationStatus = 'pending' | 'active' | 'completed' | 'failed' | 'revoked'

export interface DelegationState {
  id: string
  delegatorId: string
  delegateId: string
  scope: string[]
  permissions: string[]
  status: DelegationStatus
  createdAt: number
  updatedAt: number
  expiresAt?: number
  metadata?: Record<string, unknown>
}

export interface DelegationStore {
  get(delegationId: string): Promise<DelegationState | null>
  getByDelegator(delegatorId: string): Promise<DelegationState[]>
  getByDelegate(delegateId: string): Promise<DelegationState[]>
  save(delegation: DelegationState): Promise<void>
  update(delegationId: string, updates: Partial<DelegationState>): Promise<void>
  revoke(delegationId: string): Promise<void>
  list(): Promise<DelegationState[]>
  clear(): Promise<void>
}

// ============================================================================
// Cron Task Types
// ============================================================================

export interface CronTaskRecord {
  id: string
  name: string
  description?: string
  cronExpression: string
  handler: string
  params?: Record<string, unknown>
  enabled: boolean
  maxRuns?: number
  runCount: number
  createdAt: number
  updatedAt: number
  lastRunAt?: number
  nextRunAt?: number
  status: TaskStatus
}

export interface CronExecutionRecord {
  id: string
  taskId: string
  startedAt: number
  completedAt?: number
  success: boolean
  result?: unknown
  error?: string
  durationMs?: number
}

export interface CronStore {
  // Task operations
  getTask(taskId: string): Promise<CronTaskRecord | null>
  getAllTasks(): Promise<CronTaskRecord[]>
  getEnabledTasks(): Promise<CronTaskRecord[]>
  saveTask(task: CronTaskRecord): Promise<void>
  updateTask(taskId: string, updates: Partial<CronTaskRecord>): Promise<void>
  deleteTask(taskId: string): Promise<void>
  
  // Execution operations
  getExecutions(taskId: string, limit?: number): Promise<CronExecutionRecord[]>
  saveExecution(execution: CronExecutionRecord): Promise<void>
  clearExecutions(taskId: string): Promise<void>
  
  // Utility
  clear(): Promise<void>
}

// ============================================================================
// File Store Types (Atomic Write)
// ============================================================================

export interface FileStoreOptions {
  /** File extension to use (default: '.json') */
  extension?: string
  /** Directory path for storing files */
  basePath?: string
  /** Enable atomic writes using temp file + rename (default: true) */
  atomic?: boolean
}

export interface FileStore {
  /** Read and parse a JSON file */
  read<T>(key: string): Promise<T | null>
  /** Write with atomic rename pattern */
  write<T>(key: string, data: T): Promise<void>
  /** Check if key exists */
  has(key: string): Promise<boolean>
  /** Delete a file */
  delete(key: string): Promise<void>
  /** List all keys with optional prefix filter */
  list(prefix?: string): Promise<string[]>
  /** Clear all files */
  clear(): Promise<void>
}

// ============================================================================
// Persistence Backend Types
// ============================================================================

export type PersistenceBackend = 'memory' | 'localStorage' | 'indexedDB' | 'fileSystem'

export interface PersistenceConfig {
  backend: PersistenceBackend
  prefix?: string
  fileOptions?: FileStoreOptions
}
