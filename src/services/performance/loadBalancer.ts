import { Worker, LoadBalancerConfig, defaultLoadBalancerConfig } from './performanceTypes'

const generateId = (): string => Math.random().toString(36).substring(2, 11)

export class LoadBalancer {
  private workers: Map<string, Worker> = new Map()
  private config: LoadBalancerConfig
  private currentIndex = 0

  constructor(config: Partial<LoadBalancerConfig> = {}) {
    this.config = { ...defaultLoadBalancerConfig, ...config }
  }

  addWorker(id?: string, maxLoad = 100): string {
    const workerId = id || generateId()
    this.workers.set(workerId, {
      id: workerId,
      load: 0,
      maxLoad,
      healthy: true,
      lastHealthCheck: Date.now()
    })
    return workerId
  }

  removeWorker(id: string): boolean {
    return this.workers.delete(id)
  }

  getWorker(id: string): Worker | undefined {
    return this.workers.get(id)
  }

  getAllWorkers(): Worker[] {
    return Array.from(this.workers.values())
  }

  private selectByStrategy(): Worker | undefined {
    const healthyWorkers = this.getHealthyWorkers()
    if (healthyWorkers.length === 0) return undefined

    switch (this.config.strategy) {
      case 'round_robin': {
        const worker = healthyWorkers[this.currentIndex % healthyWorkers.length]
        this.currentIndex++
        return worker
      }

      case 'least_loaded': {
        return healthyWorkers.reduce((min, w) =>
          w.load < min.load ? w : min
        )
      }

      case 'random': {
        return healthyWorkers[Math.floor(Math.random() * healthyWorkers.length)]
      }

      case 'weighted': {
        const totalWeight = healthyWorkers.reduce((sum, w) => sum + (w.maxLoad - w.load), 0)
        let random = Math.random() * totalWeight
        for (const w of healthyWorkers) {
          random -= (w.maxLoad - w.load)
          if (random <= 0) return w
        }
        return healthyWorkers[0]
      }

      default:
        return healthyWorkers[0]
    }
  }

  select(): Worker | undefined {
    const worker = this.selectByStrategy()
    if (worker) {
      worker.load++
    }
    return worker
  }

  release(workerId: string): void {
    const worker = this.workers.get(workerId)
    if (worker && worker.load > 0) {
      worker.load--
    }
  }

  updateLoad(workerId: string, load: number): void {
    const worker = this.workers.get(workerId)
    if (worker) {
      worker.load = Math.max(0, Math.min(load, worker.maxLoad))
    }
  }

  setHealthy(workerId: string, healthy: boolean): void {
    const worker = this.workers.get(workerId)
    if (worker) {
      worker.healthy = healthy
      worker.lastHealthCheck = Date.now()
    }
  }

  private getHealthyWorkers(): Worker[] {
    return Array.from(this.workers.values()).filter(w => w.healthy)
  }

  getStats(): { total: number; healthy: number; avgLoad: number } {
    const workers = Array.from(this.workers.values())
    const healthy = workers.filter(w => w.healthy)
    const totalLoad = workers.reduce((sum, w) => sum + w.load, 0)
    return {
      total: workers.length,
      healthy: healthy.length,
      avgLoad: workers.length > 0 ? totalLoad / workers.length : 0
    }
  }
}

export const loadBalancer = new LoadBalancer()
