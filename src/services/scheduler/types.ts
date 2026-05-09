/**
 * P9: Task Scheduling - Schedule Types
 * 
 * Types for scheduled task system.
 */

export type ScheduleType = 'once' | 'interval' | 'cron'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ScheduledTask {
  id: string
  name: string
  description?: string
  type: ScheduleType
  // For 'once' type
  scheduledAt?: number  // Unix timestamp
  // For 'interval' type
  intervalMs?: number
  // For 'cron' type
  cronExpression?: string
  // Task payload
  handler: string  // Function name or module path
  params?: Record<string, unknown>
  // Metadata
  status: TaskStatus
  createdAt: number
  updatedAt: number
  lastRunAt?: number
  nextRunAt?: number
  runCount: number
  maxRuns?: number  // Optional limit
  enabled: boolean
  // Retry config
  retryOnFailure: boolean
  maxRetries: number
}

export interface TaskExecution {
  id: string
  taskId: string
  startedAt: number
  completedAt?: number
  success: boolean
  result?: unknown
  error?: string
  durationMs?: number
}

export interface ScheduleConfig {
  timezone?: string
  maxConcurrentTasks?: number
  persistTasks?: boolean  // Store tasks in localStorage/IndexedDB
  persistExecutions?: boolean
}

export interface TaskRegistry {
  register(handler: string, fn: Function): void
  unregister(handler: string): void
  get(handler: string): Function | undefined
  list(): string[]
}

// Cron field validation
export interface CronFields {
  second?: string  // 0-59
  minute: string   // 0-59
  hour: string     // 0-23
  dayOfMonth: string  // 1-31
  month: string    // 1-12
  dayOfWeek: string   // 0-7 (0 and 7 are Sunday)
}

// Cron expression helper
export interface CronExpression {
  toString(): string
  getNextRun(from?: Date): Date | null
  validate(): { valid: boolean; error?: string }
}

// Validation result
export interface ValidationResult {
  valid: boolean
  error?: string
}

// Task dependency chain
export interface TaskDependency {
  taskId: string
  dependsOn: string[]  // Must complete before this task runs
}