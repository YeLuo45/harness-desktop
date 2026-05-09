import { ResourceQuota, ResourceUsage, ExecutionContext, DEFAULT_RESOURCE_QUOTA } from './resourceTypes'

const generateId = (): string => Math.random().toString(36).substring(2, 15)

export class ResourceQuotaManager {
  private quotas: Map<string, ResourceQuota> = new Map()
  private usage: Map<string, ResourceUsage> = new Map()

  setQuota(agentId: string, quota: ResourceQuota): void {
    this.quotas.set(agentId, quota)
  }

  getQuota(agentId: string): ResourceQuota {
    return this.quotas.get(agentId) || { ...DEFAULT_RESOURCE_QUOTA }
  }

  getUsage(agentId: string): ResourceUsage {
    return this.usage.get(agentId) || {
      memoryUsedMB: 0,
      cpuTimeUsedMs: 0,
      execTimeUsedMs: 0,
      fileSizeUsedMB: 0,
      networkCalls: 0,
      timestamp: Date.now()
    }
  }

  updateUsage(agentId: string, updates: Partial<ResourceUsage>): void {
    const current = this.getUsage(agentId)
    this.usage.set(agentId, { ...current, ...updates, timestamp: Date.now() })
  }

  checkQuota(agentId: string): { withinQuota: boolean; exceededResources: string[] } {
    const quota = this.getQuota(agentId)
    const usage = this.getUsage(agentId)
    const exceeded: string[] = []

    if (usage.memoryUsedMB > quota.memoryMB) exceeded.push('memory')
    if (usage.cpuTimeUsedMs > quota.cpuTimeMs) exceeded.push('cpu')
    if (usage.execTimeUsedMs > quota.maxExecTimeMs) exceeded.push('execution_time')
    if (usage.fileSizeUsedMB > quota.maxFileSizeMB) exceeded.push('file_size')
    if (usage.networkCalls > quota.maxNetworkCalls) exceeded.push('network')

    return { withinQuota: exceeded.length === 0, exceededResources: exceeded }
  }

  getUtilization(agentId: string): Record<string, number> {
    const quota = this.getQuota(agentId)
    const usage = this.getUsage(agentId)

    return {
      memoryPercent: quota.memoryMB > 0 ? (usage.memoryUsedMB / quota.memoryMB) * 100 : 0,
      cpuPercent: quota.cpuTimeMs > 0 ? (usage.cpuTimeUsedMs / quota.cpuTimeMs) * 100 : 0,
      timePercent: quota.maxExecTimeMs > 0 ? (usage.execTimeUsedMs / quota.maxExecTimeMs) * 100 : 0
    }
  }

  resetUsage(agentId: string): void {
    this.usage.set(agentId, {
      memoryUsedMB: 0,
      cpuTimeUsedMs: 0,
      execTimeUsedMs: 0,
      fileSizeUsedMB: 0,
      networkCalls: 0,
      timestamp: Date.now()
    })
  }

  removeQuota(agentId: string): boolean {
    this.quotas.delete(agentId)
    this.usage.delete(agentId)
    return true
  }
}

export const resourceQuotaManager = new ResourceQuotaManager()