// Performance Optimization Types

export enum Priority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3
}

export enum TaskStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface ScheduledTask {
  id: string
  type: string
  priority: Priority
  payload: unknown
  createdAt: number
  scheduledAt?: number
  startedAt?: number
  completedAt?: number
  result?: unknown
  error?: string
  retries: number
  maxRetries: number
  timeout: number
}

export interface QueueStats {
  pending: number
  running: number
  completed: number
  failed: number
  avgWaitTime: number
  avgProcessTime: number
}

export interface SchedulerStats {
  throughput: number
  cacheHitRate: number
  cacheMissRate: number
  loadAverage: number
  totalProcessed: number
  totalFailed: number
  uptime: number
}

export interface CacheEntry {
  key: string
  value: unknown
  createdAt: number
  expiresAt: number
  hits: number
}

export interface LoadBalancerConfig {
  strategy: 'round_robin' | 'least_loaded' | 'random' | 'weighted'
  healthCheckInterval: number
  maxWorkerLoad: number
}

export interface Worker {
  id: string
  load: number
  maxLoad: number
  healthy: boolean
  lastHealthCheck: number
}

export interface SchedulerConfig {
  maxQueueSize: number
  maxConcurrentTasks: number
  defaultPriority: Priority
  enableCaching: boolean
  cacheTTL: number
  cacheMaxSize: number
  defaultTimeout: number
  defaultMaxRetries: number
}

export const defaultSchedulerConfig: SchedulerConfig = {
  maxQueueSize: 10000,
  maxConcurrentTasks: 100,
  defaultPriority: Priority.NORMAL,
  enableCaching: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  cacheMaxSize: 1000,
  defaultTimeout: 30000,
  defaultMaxRetries: 3
}

export const defaultLoadBalancerConfig: LoadBalancerConfig = {
  strategy: 'round_robin',
  healthCheckInterval: 30000,
  maxWorkerLoad: 100
}
