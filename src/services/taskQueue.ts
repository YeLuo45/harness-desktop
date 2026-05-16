/**
 * Task Queue Service
 * 
 * Implements FIFO + priority queue for task scheduling.
 * Used by the multi-agent engine for unattended task processing.
 */

import { v4 as uuidv4 } from 'uuid'

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low'
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface QueuedTask {
  id: string
  taskType: string
  payload: unknown
  priority: TaskPriority
  status: TaskStatus
  createdAt: number
  queuedAt?: number
  startedAt?: number
  completedAt?: number
  retryCount: number
  maxRetries: number
  timeout: number
  error?: string
  result?: unknown
  metadata?: Record<string, unknown>
}

export interface QueueStats {
  pending: number
  queued: number
  running: number
  completed: number
  failed: number
  cancelled: number
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3
}

export class TaskQueue {
  private queue: QueuedTask[] = []
  private runningTasks: Map<string, QueuedTask> = new Map()
  private completedTasks: Map<string, QueuedTask> = new Map()
  private failedTasks: Map<string, QueuedTask> = new Map()
  private listeners: Map<string, Array<(task: QueuedTask) => void>> = new Map()
  private maxQueueSize: number
  private defaultTimeout: number
  private defaultMaxRetries: number

  constructor(options?: {
    maxQueueSize?: number
    defaultTimeout?: number
    defaultMaxRetries?: number
  }) {
    this.maxQueueSize = options?.maxQueueSize || 1000
    this.defaultTimeout = options?.defaultTimeout || 30000
    this.defaultMaxRetries = options?.defaultMaxRetries || 3
  }

  /**
   * Generate unique task ID
   */
  private generateId(): string {
    return `task-${uuidv4()}`
  }

  /**
   * Enqueue a task (FIFO within same priority)
   */
  enqueue(
    taskType: string,
    payload: unknown,
    options?: {
      priority?: TaskPriority
      timeout?: number
      maxRetries?: number
      metadata?: Record<string, unknown>
    }
  ): string {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`Queue is full (max: ${this.maxQueueSize})`)
    }

    const id = this.generateId()
    const task: QueuedTask = {
      id,
      taskType,
      payload,
      priority: options?.priority || 'normal',
      status: 'pending',
      createdAt: Date.now(),
      queuedAt: Date.now(),
      retryCount: 0,
      maxRetries: options?.maxRetries ?? this.defaultMaxRetries,
      timeout: options?.timeout ?? this.defaultTimeout,
      metadata: options?.metadata
    }

    // Insert based on priority (FIFO within same priority)
    this.insertByPriority(task)
    
    this.emit('enqueue', task)
    return id
  }

  /**
   * Insert task maintaining priority order and FIFO within same priority
   */
  private insertByPriority(task: QueuedTask): void {
    const insertIndex = this.queue.findIndex(t => 
      PRIORITY_ORDER[t.priority] > PRIORITY_ORDER[t.priority]
    )
    
    if (insertIndex === -1) {
      // Find the last task with same or lower priority (maintain FIFO)
      let lastSamePriorityIndex = this.queue.length - 1
      for (let i = this.queue.length - 1; i >= 0; i--) {
        if (PRIORITY_ORDER[this.queue[i].priority] === PRIORITY_ORDER[task.priority]) {
          lastSamePriorityIndex = i
        } else if (PRIORITY_ORDER[this.queue[i].priority] > PRIORITY_ORDER[task.priority]) {
          break
        }
      }
      this.queue.splice(lastSamePriorityIndex + 1, 0, task)
    } else {
      this.queue.splice(insertIndex, 0, task)
    }
  }

  /**
   * Dequeue the next task (highest priority first)
   */
  dequeue(): QueuedTask | undefined {
    const task = this.queue.shift()
    if (!task) return undefined

    task.status = 'queued'
    return task
  }

  /**
   * Peek at next task without removing
   */
  peek(): QueuedTask | undefined {
    return this.queue[0]
  }

  /**
   * Get task by ID
   */
  get(taskId: string): QueuedTask | undefined {
    // Check all collections
    return (
      this.queue.find(t => t.id === taskId) ||
      this.runningTasks.get(taskId) ||
      this.completedTasks.get(taskId) ||
      this.failedTasks.get(taskId)
    )
  }

  /**
   * Start executing a task
   */
  startTask(taskId: string): boolean {
    const task = this.queue.find(t => t.id === taskId)
    if (!task) return false

    this.queue = this.queue.filter(t => t.id !== taskId)
    task.status = 'running'
    task.startedAt = Date.now()
    this.runningTasks.set(taskId, task)
    this.emit('start', task)
    return true
  }

  /**
   * Mark task as completed
   */
  completeTask(taskId: string, result?: unknown): boolean {
    const task = this.runningTasks.get(taskId)
    if (!task) return false

    task.status = 'completed'
    task.completedAt = Date.now()
    task.result = result
    this.runningTasks.delete(taskId)
    this.completedTasks.set(taskId, task)
    this.emit('complete', task)
    return true
  }

  /**
   * Mark task as failed (with retry support)
   */
  failTask(taskId: string, error: string): { retried: boolean; task?: QueuedTask } {
    const task = this.runningTasks.get(taskId)
    if (!task) return { retried: false }

    task.error = error
    task.retryCount++

    if (task.retryCount < task.maxRetries) {
      // Re-queue for retry
      task.status = 'pending'
      task.startedAt = undefined
      this.runningTasks.delete(taskId)
      this.insertByPriority(task)
      this.emit('retry', task)
      return { retried: true, task }
    } else {
      // Max retries exceeded
      task.status = 'failed'
      task.completedAt = Date.now()
      this.runningTasks.delete(taskId)
      this.failedTasks.set(taskId, task)
      this.emit('fail', task)
      return { retried: false }
    }
  }

  /**
   * Cancel a task
   */
  cancel(taskId: string): boolean {
    // Check queue
    let task = this.queue.find(t => t.id === taskId)
    if (task) {
      this.queue = this.queue.filter(t => t.id !== taskId)
      task.status = 'cancelled'
      task.completedAt = Date.now()
      this.emit('cancel', task)
      return true
    }

    // Check running
    task = this.runningTasks.get(taskId)
    if (task) {
      task.status = 'cancelled'
      task.completedAt = Date.now()
      this.runningTasks.delete(taskId)
      this.emit('cancel', task)
      return true
    }

    return false
  }

  /**
   * Update task priority
   */
  updatePriority(taskId: string, newPriority: TaskPriority): boolean {
    const task = this.queue.find(t => t.id === taskId)
    if (!task || task.status !== 'pending') return false

    this.queue = this.queue.filter(t => t.id !== taskId)
    task.priority = newPriority
    this.insertByPriority(task)
    this.emit('priority', task)
    return true
  }

  /**
   * Remove task from queue
   */
  remove(taskId: string): boolean {
    const initialLength = this.queue.length
    this.queue = this.queue.filter(t => t.id !== taskId)
    return this.queue.length < initialLength
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return {
      pending: this.queue.filter(t => t.status === 'pending').length,
      queued: this.queue.filter(t => t.status === 'queued').length,
      running: this.runningTasks.size,
      completed: this.completedTasks.size,
      failed: this.failedTasks.size,
      cancelled: 0 // Could track this too
    }
  }

  /**
   * Get all pending tasks (sorted by priority)
   */
  getPendingTasks(): QueuedTask[] {
    return this.queue
      .filter(t => t.status === 'pending' || t.status === 'queued')
      .sort((a, b) => {
        const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        return a.createdAt - b.createdAt // FIFO
      })
  }

  /**
   * Get running tasks
   */
  getRunningTasks(): QueuedTask[] {
    return Array.from(this.runningTasks.values())
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): QueuedTask[] {
    return Array.from(this.completedTasks.values())
  }

  /**
   * Get failed tasks
   */
  getFailedTasks(): QueuedTask[] {
    return Array.from(this.failedTasks.values())
  }

  /**
   * Clear completed/failed tasks
   */
  clearHistory(): void {
    this.completedTasks.clear()
    this.failedTasks.clear()
  }

  /**
   * Subscribe to task events
   */
  on(event: 'enqueue' | 'start' | 'complete' | 'fail' | 'retry' | 'cancel' | 'priority', callback: (task: QueuedTask) => void): () => void {
    const listeners = this.listeners.get(event) || []
    listeners.push(callback)
    this.listeners.set(event, listeners)

    // Return unsubscribe function
    return () => {
      const current = this.listeners.get(event) || []
      this.listeners.set(event, current.filter(cb => cb !== callback))
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, task: QueuedTask): void {
    const listeners = this.listeners.get(event) || []
    for (const callback of listeners) {
      try {
        callback(task)
      } catch (error) {
        console.error(`[TaskQueue] Event listener error (${event}):`, error)
      }
    }
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0
  }

  /**
   * Get queue length
   */
  size(): number {
    return this.queue.length
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    this.queue = []
  }
}

// Singleton instance for global task queue
let taskQueueInstance: TaskQueue | null = null

export function getTaskQueue(): TaskQueue {
  if (!taskQueueInstance) {
    taskQueueInstance = new TaskQueue()
  }
  return taskQueueInstance
}

export function initTaskQueue(options?: {
  maxQueueSize?: number
  defaultTimeout?: number
  defaultMaxRetries?: number
}): TaskQueue {
  taskQueueInstance = new TaskQueue(options)
  return taskQueueInstance
}