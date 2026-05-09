/**
 * P9: Task Scheduling - Retry Queue
 * 
 * Implements exponential backoff retry queue.
 * Delays: 2s, 4s, 8s, 16s, 32s (max 5 retries)
 */

export interface RetryQueueItem {
  taskId: string
  attempt: number
  scheduledAt: number
}

export interface RetryQueue {
  add(taskId: string, attempt: number): void
  getNextRetry(): { taskId: string; delayMs: number } | null
  remove(taskId: string): void
  process(): void
}

// Exponential backoff delays in ms: 2s, 4s, 8s, 16s, 32s
const BACKOFF_DELAYS = [2000, 4000, 8000, 16000, 32000]
const MAX_RETRIES = 5

export class RetryQueueImpl implements RetryQueue {
  private queue: Map<string, RetryQueueItem> = new Map()
  private timer: ReturnType<typeof setTimeout> | null = null
  private onRetry: ((taskId: string) => void) | null = null

  constructor(onRetry?: (taskId: string) => void) {
    this.onRetry = onRetry || null
  }

  /**
   * Add a task to the retry queue
   */
  add(taskId: string, attempt: number): void {
    if (attempt >= MAX_RETRIES) {
      // Max retries reached, don't add to queue
      return
    }

    const delayMs = BACKOFF_DELAYS[attempt] || BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1]
    const scheduledAt = Date.now() + delayMs

    this.queue.set(taskId, {
      taskId,
      attempt,
      scheduledAt
    })

    // Schedule processing
    this.scheduleProcess()
  }

  /**
   * Get the next task that should be retried
   */
  getNextRetry(): { taskId: string; delayMs: number } | null {
    const now = Date.now()
    let earliest: RetryQueueItem | null = null

    for (const item of this.queue.values()) {
      if (item.scheduledAt <= now) {
        if (!earliest || item.scheduledAt < earliest.scheduledAt) {
          earliest = item
        }
      }
    }

    if (!earliest) {
      // Find the one with earliest scheduled time even if in future
      for (const item of this.queue.values()) {
        if (!earliest || item.scheduledAt < earliest.scheduledAt) {
          earliest = item
        }
      }
    }

    if (!earliest) return null

    const delayMs = Math.max(0, earliest.scheduledAt - now)
    return { taskId: earliest.taskId, delayMs }
  }

  /**
   * Remove a task from the retry queue
   */
  remove(taskId: string): void {
    this.queue.delete(taskId)
  }

  /**
   * Process due retries
   */
  process(): void {
    const now = Date.now()
    const toRetry: string[] = []

    for (const item of this.queue.values()) {
      if (item.scheduledAt <= now) {
        toRetry.push(item.taskId)
      }
    }

    for (const taskId of toRetry) {
      const item = this.queue.get(taskId)
      if (item && item.scheduledAt <= now) {
        this.queue.delete(taskId)
        if (this.onRetry) {
          this.onRetry(taskId)
        }
      }
    }

    // Schedule next process if there are pending items
    if (this.queue.size > 0) {
      this.scheduleProcess()
    }
  }

  /**
   * Get current retry attempt for a task
   */
  getAttempt(taskId: string): number {
    return this.queue.get(taskId)?.attempt ?? -1
  }

  /**
   * Check if a task is in the retry queue
   */
  has(taskId: string): boolean {
    return this.queue.has(taskId)
  }

  /**
   * Get all items in the queue (for debugging)
   */
  getAll(): RetryQueueItem[] {
    return Array.from(this.queue.values())
  }

  /**
   * Clear the entire queue
   */
  clear(): void {
    this.queue.clear()
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private scheduleProcess(): void {
    if (this.timer) {
      clearTimeout(this.timer)
    }

    const next = this.getNextRetry()
    if (!next) return

    const delay = Math.max(100, next.delayMs) // Minimum 100ms delay
    this.timer = setTimeout(() => {
      this.process()
    }, delay)
  }
}

/**
 * Calculate delay for a given attempt number
 */
export function getBackoffDelay(attempt: number): number {
  if (attempt < 0) return 0
  if (attempt >= BACKOFF_DELAYS.length) return BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1]
  return BACKOFF_DELAYS[attempt]
}

/**
 * Get max number of retries supported
 */
export function getMaxRetries(): number {
  return MAX_RETRIES
}
