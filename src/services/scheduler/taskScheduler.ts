/**
 * P9: Task Scheduling - TaskScheduler
 * 
 * Core scheduler implementation with IndexedDB persistence via CronStore,
 * cron parsing, dependency chains, and exponential backoff retry.
 */

import { v4 as uuidv4 } from 'uuid'
import type { 
  ScheduledTask, 
  TaskExecution, 
  ScheduleConfig, 
  TaskStatus,
  TaskRegistry,
  TaskDependency
} from './types'
import { getNextRunTime as getCronNextRunTime, isValidCron } from './cronParser'
import { RetryQueueImpl, getBackoffDelay, getMaxRetries } from './taskQueue'
import { cronStore, CronStore } from './cronStore'

export class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map()
  private executions: Map<string, TaskExecution[]> = new Map()
  private runningTasks: Set<string> = new Set()
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private registry: TaskRegistry
  private config: ScheduleConfig
  private initialized: boolean = false
  private retryQueue: RetryQueueImpl
  private dependencies: Map<string, TaskDependency> = new Map()
  private completedTasks: Set<string> = new Set()

  constructor(registry: TaskRegistry, config: ScheduleConfig = {}) {
    this.registry = registry
    this.config = {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      maxConcurrentTasks: 5,
      persistTasks: true,
      persistExecutions: true,
      ...config
    }
    this.retryQueue = new RetryQueueImpl((taskId) => this.handleRetry(taskId))
  }

  /**
   * Initialize scheduler and restore tasks from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    
    if (this.config.persistTasks) {
      await this.loadTasks()
      await this.loadDependencies()
      await this.loadExecutions()
    }
    
    // Schedule all enabled tasks
    this.tasks.forEach(task => {
      if (task.enabled) {
        this.scheduleTask(task)
      }
    })
    
    // Record initialization state
    await cronStore.saveSchedulerState({
      lastInitialized: Date.now(),
      version: 1
    })
    
    this.initialized = true
  }

  /**
   * Create a new scheduled task
   */
  async createTask(task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'runCount'>): Promise<ScheduledTask> {
    const now = Date.now()
    
    // Validate cron expression if provided
    if (task.type === 'cron' && task.cronExpression) {
      if (!isValidCron(task.cronExpression)) {
        throw new Error(`Invalid cron expression: ${task.cronExpression}`)
      }
    }
    
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
    
    // Validate cron expression if being updated
    if (updates.type === 'cron' && updates.cronExpression) {
      if (!isValidCron(updates.cronExpression)) {
        throw new Error(`Invalid cron expression: ${updates.cronExpression}`)
      }
    } else if (updates.cronExpression && task.type !== 'cron') {
      // Cron expression added to non-cron task
      if (!isValidCron(updates.cronExpression)) {
        throw new Error(`Invalid cron expression: ${updates.cronExpression}`)
      }
    }
    
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
    this.retryQueue.remove(id)
    this.dependencies.delete(id)
    const deleted = this.tasks.delete(id)
    if (deleted) {
      await this.persistTasks()
      await this.persistDependencies()
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
    
    // Check dependencies before running
    if (!this.canRunTask(id)) {
      throw new Error(`Task ${id} has unmet dependencies`)
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
        if (task.cronExpression) {
          return getCronNextRunTime(task.cronExpression, task.lastRunAt || Date.now()) ?? undefined
        }
        return undefined
      default:
        return undefined
    }
  }

  // ========== Dependency Chain Methods ==========

  /**
   * Set dependencies for a task
   */
  async setTaskDependencies(taskId: string, dependsOn: string[]): Promise<void> {
    if (!this.tasks.has(taskId)) {
      throw new Error(`Task ${taskId} not found`)
    }
    
    // Validate all dependency tasks exist
    for (const depId of dependsOn) {
      if (!this.tasks.has(depId)) {
        throw new Error(`Dependency task ${depId} not found`)
      }
    }
    
    const dependency: TaskDependency = {
      taskId,
      dependsOn
    }
    
    this.dependencies.set(taskId, dependency)
    await this.persistDependencies()
  }

  /**
   * Get dependencies for a task
   */
  getTaskDependencies(taskId: string): TaskDependency | undefined {
    return this.dependencies.get(taskId)
  }

  /**
   * Check if a task can run (all dependencies completed)
   */
  canRunTask(taskId: string): boolean {
    const dependency = this.dependencies.get(taskId)
    if (!dependency || dependency.dependsOn.length === 0) {
      return true
    }
    
    return dependency.dependsOn.every(depId => this.completedTasks.has(depId))
  }

  /**
   * Mark a task as completed (call after successful execution)
   */
  markTaskCompleted(taskId: string): void {
    this.completedTasks.add(taskId)
  }

  /**
   * Clear completed tasks tracking
   */
  clearCompletedTasks(): void {
    this.completedTasks.clear()
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
        if (task.cronExpression) {
          const nextRun = getCronNextRunTime(task.cronExpression, Date.now())
          if (nextRun) {
            delay = nextRun - Date.now()
          } else {
            return
          }
        } else {
          return
        }
        break
      default:
        return
    }

    const timer = setTimeout(() => {
      this.runTask(task)
    }, Math.max(0, delay))

    this.timers.set(task.id, timer)
    task.nextRunAt = Date.now() + delay
  }

  private async runTask(task: ScheduledTask): Promise<TaskExecution> {
    // Check dependencies
    if (!this.canRunTask(task.id)) {
      // Reschedule for later when dependencies might be met
      const timer = setTimeout(() => {
        this.scheduleTask(task)
      }, 5000) // Check again in 5 seconds
      this.timers.set(task.id, timer)
      
      return {
        id: uuidv4(),
        taskId: task.id,
        startedAt: Date.now(),
        success: false,
        error: 'Unmet dependencies'
      }
    }

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
      this.markTaskCompleted(task.id)
    } catch (error) {
      execution.success = false
      execution.error = error instanceof Error ? error.message : String(error)
      task.status = 'failed'

      if (task.retryOnFailure && task.runCount < (task.maxRuns || task.maxRetries || 3)) {
        // Use exponential backoff retry queue
        const attempt = task.runCount - 1 // 0-indexed attempt
        const delay = getBackoffDelay(attempt)
        
        setTimeout(() => {
          this.retryQueue.add(task.id, attempt)
        }, delay)
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
        this.markTaskCompleted(task.id)
      }
    }

    return execution
  }

  private handleRetry(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task || !task.enabled) return
    
    this.runTask(task)
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
      const tasks = await cronStore.getAllTasks()
      tasks.forEach(task => this.tasks.set(task.id, task))
    } catch (error) {
      console.error('Failed to load tasks from storage:', error)
    }
  }

  private async loadDependencies(): Promise<void> {
    try {
      const deps = await cronStore.getAllDependencies()
      deps.forEach(dep => this.dependencies.set(dep.taskId, dep))
    } catch (error) {
      console.error('Failed to load dependencies from storage:', error)
    }
  }

  private async loadExecutions(): Promise<void> {
    try {
      const executions = await cronStore.getAllExecutions()
      executions.forEach((execList, taskId) => this.executions.set(taskId, execList))
    } catch (error) {
      console.error('Failed to load executions from storage:', error)
    }
  }

  private async persistTasks(): Promise<void> {
    if (!this.config.persistTasks) return
    
    try {
      const tasks = Array.from(this.tasks.values())
      await cronStore.saveTasks(tasks)
    } catch (error) {
      console.error('Failed to persist tasks:', error)
    }
  }

  private async persistDependencies(): Promise<void> {
    if (!this.config.persistTasks) return
    
    try {
      await cronStore.saveDependencies(this.dependencies)
    } catch (error) {
      console.error('Failed to persist dependencies:', error)
    }
  }

  private async persistExecutions(): Promise<void> {
    if (!this.config.persistExecutions) return
    
    try {
      this.executions.forEach((execList, taskId) => {
        execList.forEach(exec => {
          cronStore.saveExecution(taskId, exec)
        })
      })
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
