import { ScheduledTask, Priority, TaskStatus, QueueStats } from './performanceTypes'

export class PriorityQueue {
  private queues: Map<Priority, ScheduledTask[]> = new Map()
  private taskMap: Map<string, ScheduledTask> = new Map()
  private totalWaitTime = 0
  private totalProcessTime = 0
  private completedCount = 0

  constructor() {
    // Initialize priority queues
    for (const p of [Priority.CRITICAL, Priority.HIGH, Priority.NORMAL, Priority.LOW]) {
      this.queues.set(p, [])
    }
  }

  enqueue(task: ScheduledTask): void {
    const queue = this.queues.get(task.priority)!
    queue.push(task)
    this.taskMap.set(task.id, task)
  }

  dequeue(): ScheduledTask | undefined {
    // CRITICAL -> HIGH -> NORMAL -> LOW
    for (const p of [Priority.CRITICAL, Priority.HIGH, Priority.NORMAL, Priority.LOW]) {
      const queue = this.queues.get(p)!
      if (queue.length > 0) {
        const task = queue.shift()!
        return task
      }
    }
    return undefined
  }

  remove(taskId: string): boolean {
    const task = this.taskMap.get(taskId)
    if (!task) return false

    const queue = this.queues.get(task.priority)!
    const idx = queue.findIndex(t => t.id === taskId)
    if (idx >= 0) {
      queue.splice(idx, 1)
      this.taskMap.delete(taskId)
      return true
    }
    return false
  }

  updatePriority(taskId: string, newPriority: Priority): boolean {
    const task = this.taskMap.get(taskId)
    if (!task) return false

    if (task.priority === newPriority) return true

    // Remove from old queue
    const oldQueue = this.queues.get(task.priority)!
    const idx = oldQueue.findIndex(t => t.id === taskId)
    if (idx >= 0) {
      oldQueue.splice(idx, 1)
    }

    // Add to new queue
    task.priority = newPriority
    const newQueue = this.queues.get(newPriority)!
    newQueue.push(task)

    return true
  }

  get(taskId: string): ScheduledTask | undefined {
    return this.taskMap.get(taskId)
  }

  getAll(): ScheduledTask[] {
    return Array.from(this.taskMap.values())
  }

  size(): number {
    return this.taskMap.size
  }

  isEmpty(): boolean {
    return this.taskMap.size === 0
  }

  getStats(): QueueStats {
    const now = Date.now()
    let totalWaitTime = 0
    let pending = 0
    let running = 0
    let completed = 0
    let failed = 0

    for (const task of this.taskMap.values()) {
      switch (task.status) {
        case TaskStatus.PENDING:
        case TaskStatus.SCHEDULED:
          pending++
          totalWaitTime += now - task.createdAt
          break
        case TaskStatus.RUNNING:
          running++
          break
        case TaskStatus.COMPLETED:
          completed++
          if (task.completedAt && task.startedAt) {
            this.totalProcessTime += task.completedAt - task.startedAt
          }
          break
        case TaskStatus.FAILED:
          failed++
          break
      }
    }

    this.totalWaitTime = totalWaitTime

    const total = pending + running + completed + failed
    return {
      pending,
      running,
      completed,
      failed,
      avgWaitTime: total > 0 ? this.totalWaitTime / total : 0,
      avgProcessTime: this.totalProcessTime / (completed || 1)
    }
  }
}
