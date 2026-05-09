import { CacheEntry, SchedulerConfig, defaultSchedulerConfig } from './performanceTypes'

export class ResultCache {
  private cache: Map<string, CacheEntry> = new Map()
  private config: SchedulerConfig
  private hits = 0
  private misses = 0

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...defaultSchedulerConfig, ...config }
  }

  private generateKey(taskType: string, payload: unknown): string {
    return `${taskType}:${JSON.stringify(payload)}`
  }

  get(taskType: string, payload: unknown): unknown | undefined {
    const key = this.generateKey(taskType, payload)
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return undefined
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.misses++
      return undefined
    }

    // Update hits
    entry.hits++
    this.hits++
    return entry.value
  }

  set(taskType: string, payload: unknown, value: unknown): void {
    if (!this.config.enableCaching) return

    // Evict if full
    if (this.cache.size >= this.config.cacheMaxSize) {
      this.evictLRU()
    }

    const key = this.generateKey(taskType, payload)
    const now = Date.now()

    this.cache.set(key, {
      key,
      value,
      createdAt: now,
      expiresAt: now + this.config.cacheTTL,
      hits: 0
    })
  }

  private evictLRU(): void {
    let oldest: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt
        oldest = key
      }
    }

    if (oldest) {
      this.cache.delete(oldest)
    }
  }

  invalidate(taskType?: string): void {
    if (taskType) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${taskType}:`)) {
          this.cache.delete(key)
        }
      }
    } else {
      this.cache.clear()
    }
  }

  getHitRate(): number {
    const total = this.hits + this.misses
    return total > 0 ? this.hits / total : 0
  }

  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate()
    }
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }
}

export const resultCache = new ResultCache()
