import { ResourceAlert, ResourceStats, ResourceQuota, DEFAULT_RESOURCE_QUOTA } from './resourceTypes'
import { resourceQuotaManager } from './resourceQuota'
import { executionContextManager } from './executionContext'

const generateId = (): string => Math.random().toString(36).substring(2, 15)

export class ResourceMonitor {
  private alerts: ResourceAlert[] = []
  private listeners: Set<(alert: ResourceAlert) => void> = new Set()
  private alertThresholds: Record<string, { warning: number; critical: number }> = {
    memory: { warning: 70, critical: 90 },
    cpu: { warning: 70, critical: 90 },
    time: { warning: 80, critical: 95 }
  }

  constructor() {
    // Set default quotas for all agents
    this.initializeDefaultQuotas()
  }

  private initializeDefaultQuotas(): void {
    // This would be called during initialization
  }

  getStats(): ResourceStats {
    const contexts = executionContextManager.getActiveContexts()

    let totalMemory = 0
    let totalCpu = 0

    for (const context of contexts) {
      totalMemory += context.usage.memoryUsedMB
      totalCpu += context.usage.cpuTimeUsedMs
    }

    const quota = DEFAULT_RESOURCE_QUOTA

    return {
      totalAgents: contexts.length,
      activeAgents: contexts.length,
      totalMemoryUsedMB: totalMemory,
      totalCpuTimeUsedMs: totalCpu,
      avgMemoryUsagePercent: quota.memoryMB > 0 ? (totalMemory / quota.memoryMB) * 100 : 0,
      avgCpuUsagePercent: quota.cpuTimeMs > 0 ? (totalCpu / quota.cpuTimeMs) * 100 : 0
    }
  }

  checkAndAlert(agentId: string): ResourceAlert[] {
    const utilization = resourceQuotaManager.getUtilization(agentId)
    const newAlerts: ResourceAlert[] = []

    for (const [resource, percent] of Object.entries(utilization)) {
      const thresholds = this.alertThresholds[resource]
      if (!thresholds) continue

      if (percent >= thresholds.critical) {
        const alert = this.createAlert(agentId, resource, percent, thresholds.critical, 'critical')
        newAlerts.push(alert)
      } else if (percent >= thresholds.warning) {
        const alert = this.createAlert(agentId, resource, percent, thresholds.warning, 'warning')
        newAlerts.push(alert)
      }
    }

    return newAlerts
  }

  private createAlert(
    agentId: string,
    resource: string,
    currentValue: number,
    threshold: number,
    severity: 'warning' | 'critical'
  ): ResourceAlert {
    const alert: ResourceAlert = {
      id: generateId(),
      type: resource as any,
      severity,
      agentId,
      message: `${resource} usage at ${currentValue.toFixed(1)}% (threshold: ${threshold}%)`,
      currentValue,
      threshold,
      timestamp: Date.now()
    }

    this.alerts.push(alert)
    this.listeners.forEach(listener => listener(alert))

    // Keep last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000)
    }

    return alert
  }

  subscribe(callback: (alert: ResourceAlert) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  getAlerts(filter?: { agentId?: string; severity?: string; limit?: number }): ResourceAlert[] {
    let results = [...this.alerts]

    if (filter?.agentId) {
      results = results.filter(a => a.agentId === filter.agentId)
    }

    if (filter?.severity) {
      results = results.filter(a => a.severity === filter.severity)
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp)

    if (filter?.limit) {
      results = results.slice(0, filter.limit)
    }

    return results
  }

  clearAlerts(agentId?: string): void {
    if (agentId) {
      this.alerts = this.alerts.filter(a => a.agentId !== agentId)
    } else {
      this.alerts = []
    }
  }

  setThresholds(resource: string, warning: number, critical: number): void {
    this.alertThresholds[resource] = { warning, critical }
  }

  getThresholds(): Record<string, { warning: number; critical: number }> {
    return { ...this.alertThresholds }
  }

  getTopConsumers(resource: string, limit = 5): { agentId: string; value: number }[] {
    const contexts = executionContextManager.getAllContexts()
    const consumers: { agentId: string; value: number }[] = []

    for (const context of contexts) {
      let value = 0
      switch (resource) {
        case 'memory':
          value = context.usage.memoryUsedMB
          break
        case 'cpu':
          value = context.usage.cpuTimeUsedMs
          break
        case 'time':
          value = context.usage.execTimeUsedMs
          break
        default:
          continue
      }
      consumers.push({ agentId: context.agentId, value })
    }

    return consumers.sort((a, b) => b.value - a.value).slice(0, limit)
  }
}

export const resourceMonitor = new ResourceMonitor()