import {
  ScheduledTask,
  TaskStatus,
  Priority,
  SchedulerConfig,
  SchedulerStats,
  QueueStats,
  defaultSchedulerConfig
} from './performanceTypes'
import { PriorityQueue } from './priorityQueue'
import { ResultCache } from './resultCache'
import { LoadBalancer } from './loadBalancer'

const generateId = (): string => Math.random().toString(36).substring(2, 11)

export class TaskScheduler {
  private queue: PriorityQueue
  private cache: ResultCache
  private loadBalancer: LoadBalancer
  private config: SchedulerConfig
  private isRunning = false
  private isPaused = false
  private startTime: number
  private totalProcessed = 0
  private totalFailed = 0
  private taskHandlers: Map<string, (task: ScheduledTask) => Promise<unknown>> = new Map()

  constructor(
    config: Partial<SchedulerConfig> = {},
    cache?: ResultCache,
    loadBalancer?: LoadBalancer
  ) {
    this.config = { ...defaultSchedulerConfig, ...config }
    this.queue = new PriorityQueue()
    this.cache = cache || new ResultCache(this.config)
    this.loadBalancer = loadBalancer || new LoadBalancer()
    this.startTime = Date.now()
  }

  registerHandler(taskType: string, handler: (task: ScheduledTask) => Promise<unknown>): void {
    this.taskHandlers.set(taskType, handler)
  }

  async submit(
    taskType: string,
    payload: unknown,
    options: {
      priority?: Priority
      timeout?: number
      maxRetries?: number
    } = {}
  ): Promise<string> {
    const id = generateId()
    const task: ScheduledTask = {
      id,
      type: taskType,
      priority: options.priority ?? this.config.defaultPriority,
      payload,
      createdAt: Date.now(),
      retries: 0,
      maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
      timeout: options.timeout ?? this.config.defaultTimeout,
      status: TaskStatus.PENDING
    }

    this.queue.enqueue(task)

    if (this.isRunning && !this.isPaused) {
      this.processNext()
    }

    return id
  }

  cancel(taskId: string): boolean {
    const task = this.queue.get(taskId)
    if (!task) return false

    task.status = TaskStatus.CANCELLED
    return this.queue.remove(taskId)
  }

  getStatus(taskId: string): TaskStatus | undefined {
    return this.queue.get(taskId)?.status
  }

  setPriority(taskId: string, priority: Priority): void {
    this.queue.updatePriority(taskId, priority)
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.isPaused = false
    this.processQueue()
  }

  pause(): void {
    this.isPaused = true
  }

  resume(): void {
    this.isPaused = false
    this.processQueue()
  }

  stop(): void {
    this.isRunning = false
  }

  private async processQueue(): Promise<void> {
    while (this.isRunning && !this.isPaused) {
      this.processNext()
      await this.delay(10)
    }
  }

  private async processNext(): Promise<void> {
    const task = this.queue.dequeue()
    if (!task) return

    const worker = this.loadBalancer.select()
    if (!worker) {
      // Re-queue and wait
      this.queue.enqueue(task)
      await this.delay(100)
      return
    }

    task.status = TaskStatus.RUNNING
    task.startedAt = Date.now()

    try {
      // Check cache first
      const cached = this.cache.get(task.type, task.payload)
      if (cached !== undefined) {
        task.result = cached
        task.status = TaskStatus.COMPLETED
        task.completedAt = Date.now()
        this.totalProcessed++
      } else {
        // Execute task
        const handler = this.taskHandlers.get(task.type)
        if (!handler) {
          throw new Error(`No handler for task type: ${task.type}`)
        }

        const result = await this.executeWithTimeout(task, handler)
        task.result = result
        task.status = TaskStatus.COMPLETED
        task.completedAt = Date.now()

        // Cache result
        this.cache.set(task.type, task.payload, result)
        this.totalProcessed++
      }
    } catch (error) {
      task.error = error instanceof Error ? error.message : 'Unknown error'
      task.retries++

      if (task.retries < task.maxRetries) {
        // Re-queue for retry
        task.status = TaskStatus.PENDING
        this.queue.enqueue(task)
      } else {
        task.status = TaskStatus.FAILED
        this.totalFailed++
      }
    } finally {
      this.loadBalancer.release(worker.id)
    }
  }

  private async executeWithTimeout(
    task: ScheduledTask,
    handler: (task: ScheduledTask) => Promise<unknown>
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out`))
      }, task.timeout)

      handler(task)
        .then(result => {
          clearTimeout(timeout)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeout)
          reject(error)
        })
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getQueueStats(): QueueStats {
    return this.queue.getStats()
  }

  getSchedulerStats(): SchedulerStats {
    return {
      throughput: this.totalProcessed / ((Date.now() - this.startTime) / 1000),
      cacheHitRate: this.cache.getHitRate(),
      cacheMissRate: 1 - this.cache.getHitRate(),
      loadAverage: this.loadBalancer.getStats().avgLoad,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      uptime: Date.now() - this.startTime
    }
  }
}

export const taskScheduler = new TaskScheduler()
