/**
 * P9: Task Scheduling - TaskScheduler
 * 
 * Core scheduler implementation with localStorage persistence.
 */

import { v4 as uuidv4 } from 'uuid'
import type { 
  ScheduledTask, 
  TaskExecution, 
  ScheduleConfig, 
  TaskStatus,
  TaskRegistry 
} from './types'

const STORAGE_KEY = 'harness_scheduled_tasks'
const EXECUTION_KEY = 'harness_task_executions'

export class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map()
  private executions: Map<string, TaskExecution[]> = new Map()
  private runningTasks: Set<string> = new Set()
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private registry: TaskRegistry
  private config: ScheduleConfig
  private initialized: boolean = false

  constructor(registry: TaskRegistry, config: ScheduleConfig = {}) {
    this.registry = registry
    this.config = {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      maxConcurrentTasks: 5,
      persistTasks: true,
      persistExecutions: true,
      ...config
    }
  }

  /**
   * Initialize scheduler and restore tasks from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    
    if (this.config.persistTasks) {
      await this.loadTasks()
    }
    
    // Schedule all enabled tasks
    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.scheduleTask(task)
      }
    }
    
    this.initialized = true
  }

  /**
   * Create a new scheduled task
   */
  async createTask(task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'runCount'>): Promise<ScheduledTask> {
    const now = Date.now()
    const newTask: ScheduledTask = {
      ...task,
      id: uuidv4(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      runCount: 0,
      enabled: task.enabled ?? true,
      retryOnFailure: task.retryOnFailure ?? true,
      maxRetries: task.maxRetries ?? 3
    }
    
    this.tasks.set(newTask.id, newTask)
    await this.persistTasks()
    
    if (newTask.enabled) {
      this.scheduleTask(newTask)
    }
    
    return newTask
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.get(id)
  }

  /**
   * List all tasks
   */
  listTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values())
  }

  /**
   * List tasks by status
   */
  listTasksByStatus(status: TaskStatus): ScheduledTask[] {
    return Array.from(this.tasks.values()).filter(t => t.status === status)
  }

  /**
   * Update a task
   */
  async updateTask(id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
    const task = this.tasks.get(id)
    if (!task) return null
    
    const updatedTask: ScheduledTask = {
      ...task,
      ...updates,
      id: task.id,  // Prevent ID change
      updatedAt: Date.now()
    }
    
    this.tasks.set(id, updatedTask)
    await this.persistTasks()
    
    // Reschedule if needed
    if (updates.enabled !== undefined || updates.scheduledAt || updates.intervalMs || updates.cronExpression) {
      this.cancelTask(id)
      if (updatedTask.enabled) {
        this.scheduleTask(updatedTask)
      }
    }
    
    return updatedTask
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<boolean> {
    this.cancelTask(id)
    const deleted = this.tasks.delete(id)
    if (deleted) {
      await this.persistTasks()
    }
    return deleted
  }

  /**
   * Enable a task
   */
  async enableTask(id: string): Promise<boolean> {
    const task = this.updateTask(id, { enabled: true })
    return task !== null
  }

  /**
   * Disable a task
   */
  async disableTask(id: string): Promise<boolean> {
    this.cancelTask(id)
    const task = this.updateTask(id, { enabled: false })
    return task !== null
  }

  /**
   * Execute a task immediately
   */
  async executeTask(id: string): Promise<TaskExecution> {
    const task = this.tasks.get(id)
    if (!task) {
      throw new Error(`Task ${id} not found`)
    }
    
    return this.runTask(task)
  }

  /**
   * Cancel a scheduled task
   */
  cancelTask(id: string): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(id)
    }
  }

  /**
   * Get execution history for a task
   */
  getExecutionHistory(taskId: string, limit: number = 10): TaskExecution[] {
    const executions = this.executions.get(taskId) || []
    return executions.slice(-limit)
  }

  /**
   * Clear execution history
   */
  async clearExecutionHistory(taskId?: string): Promise<void> {
    if (taskId) {
      this.executions.delete(taskId)
    } else {
      this.executions.clear()
    }
    await this.persistExecutions()
  }

  /**
   * Get next run time for a task
   */
  getNextRunTime(task: ScheduledTask): number | undefined {
    if (!task.enabled) return undefined
    
    switch (task.type) {
      case 'once':
        return task.scheduledAt
      case 'interval':
        return task.lastRunAt 
          ? task.lastRunAt + (task.intervalMs || 0)
          : Date.now() + (task.intervalMs || 0)
      case 'cron':
        // Simplified: for now, return estimated next run
        return task.lastRunAt 
          ? task.lastRunAt + 60000  // Assume 1 minute for demo
          : Date.now() + 60000
      default:
        return undefined
    }
  }

  // ========== Private Methods ==========

  private scheduleTask(task: ScheduledTask): void {
    if (this.runningTasks.size >= (this.config.maxConcurrentTasks || 5)) {
      console.warn('Max concurrent tasks reached, skipping schedule')
      return
    }

    let delay: number

    switch (task.type) {
      case 'once':
        if (task.scheduledAt && task.scheduledAt > Date.now()) {
          delay = task.scheduledAt - Date.now()
        } else {
          return  // Past scheduled time, don't reschedule
        }
        break
      case 'interval':
        delay = task.intervalMs || 60000
        break
      case 'cron':
        // Simplified: use 1 minute intervals
        delay = 60000
        break
      default:
        return
    }

    const timer = setTimeout(() => {
      this.runTask(task)
    }, delay)

    this.timers.set(task.id, timer)
    task.nextRunAt = Date.now() + delay
  }

  private async runTask(task: ScheduledTask): Promise<TaskExecution> {
    const execution: TaskExecution = {
      id: uuidv4(),
      taskId: task.id,
      startedAt: Date.now(),
      success: false
    }

    this.runningTasks.add(task.id)
    task.status = 'running'
    task.lastRunAt = Date.now()
    task.runCount++

    try {
      const handler = this.registry.get(task.handler)
      if (!handler) {
        throw new Error(`Handler '${task.handler}' not found in registry`)
      }

      const result = await handler(task.params || {})
      
      execution.success = true
      execution.result = result
      task.status = 'completed'
    } catch (error) {
      execution.success = false
      execution.error = error instanceof Error ? error.message : String(error)
      task.status = 'failed'

      if (task.retryOnFailure && task.runCount < (task.maxRuns || task.maxRetries || 3)) {
        // Retry after delay
        const retryDelay = 5000 * task.runCount  // Exponential backoff
        setTimeout(() => {
          this.runTask(task)
        }, retryDelay)
      }
    } finally {
      execution.completedAt = Date.now()
      execution.durationMs = execution.completedAt - execution.startedAt
      this.runningTasks.delete(task.id)
      
      if (task.status !== 'failed' || !task.retryOnFailure) {
        task.status = 'pending'
      }
      
      await this.persistTasks()
      this.recordExecution(execution)
      
      // Reschedule if interval/cron
      if (task.enabled && task.type !== 'once') {
        this.scheduleTask(task)
      } else if (task.type === 'once') {
        task.status = 'completed'
      }
    }

    return execution
  }

  private recordExecution(execution: TaskExecution): void {
    const taskExecutions = this.executions.get(execution.taskId) || []
    taskExecutions.push(execution)
    
    // Keep last 100 executions per task
    if (taskExecutions.length > 100) {
      taskExecutions.shift()
    }
    
    this.executions.set(execution.taskId, taskExecutions)
    this.persistExecutions()
  }

  private async loadTasks(): Promise<void> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const tasks: ScheduledTask[] = JSON.parse(stored)
        tasks.forEach(task => this.tasks.set(task.id, task))
      }
    } catch (error) {
      console.error('Failed to load tasks from storage:', error)
    }
  }

  private async persistTasks(): Promise<void> {
    if (!this.config.persistTasks) return
    
    try {
      const tasks = Array.from(this.tasks.values())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch (error) {
      console.error('Failed to persist tasks:', error)
    }
  }

  private async persistExecutions(): Promise<void> {
    if (!this.config.persistExecutions) return
    
    try {
      const executions: [string, TaskExecution[]][] = Array.from(this.executions.entries())
      localStorage.setItem(EXECUTION_KEY, JSON.stringify(executions))
    } catch (error) {
      console.error('Failed to persist executions:', error)
    }
  }
}

// Simple function registry implementation
export class SimpleTaskRegistry implements TaskRegistry {
  private functions: Map<string, Function> = new Map()

  register(handler: string, fn: Function): void {
    this.functions.set(handler, fn)
  }

  unregister(handler: string): void {
    this.functions.delete(handler)
  }

  get(handler: string): Function | undefined {
    return this.functions.get(handler)
  }

  list(): string[] {
    return Array.from(this.functions.keys())
  }
}