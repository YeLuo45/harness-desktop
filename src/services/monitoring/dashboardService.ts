import { DashboardStats, DashboardUpdate, AgentStatus, AlertStatus, AgentMetrics } from './monitorTypes'
import { metricsCollector } from './metricsCollector'
import { alertManager } from './alertManager'

export class DashboardService {
  private subscribers: Set<(update: DashboardUpdate) => void> = new Set()
  private updateInterval: number | null = null

  startAutoRefresh(intervalMs = 5000): void {
    if (this.updateInterval) return
    this.updateInterval = window.setInterval(() => {
      this.notifySubscribers({ type: 'metrics', data: null, timestamp: Date.now() })
    }, intervalMs)
  }

  stopAutoRefresh(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  getDashboardStats(): DashboardStats {
    const agents = metricsCollector.getAllAgentMetrics()
    const activeAgents = agents.filter(a => a.status !== AgentStatus.OFFLINE)
    const alerts = alertManager.getActiveAlerts()

    const totalCompleted = agents.reduce((sum, a) => sum + a.completedTasks, 0)
    const totalFailed = agents.reduce((sum, a) => sum + a.failedTasks, 0)
    const totalCpu = agents.reduce((sum, a) => sum + a.cpuPercent, 0)
    const totalMemory = agents.reduce((sum, a) => sum + a.memoryMB, 0)
    const totalResponseTime = agents.reduce((sum, a) => sum + a.avgResponseTime, 0)
    const agentCount = agents.length || 1

    return {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      totalTasks: totalCompleted + totalFailed,
      completedTasks: totalCompleted,
      failedTasks: totalFailed,
      avgCpuUsage: totalCpu / agentCount,
      avgMemoryUsage: totalMemory / agentCount,
      avgResponseTime: totalResponseTime / agentCount,
      activeAlerts: alerts.length,
      uptime: Date.now() - (agents[0]?.createdAt || Date.now())
    }
  }

  subscribe(callback: (update: DashboardUpdate) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  private notifySubscribers(update: DashboardUpdate): void {
    this.subscribers.forEach(cb => cb(update))
  }

  getTimeSeriesData(metricName: string, durationMs: number): { timestamp: number; value: number }[] {
    const window = {
      start: Date.now() - durationMs,
      end: Date.now()
    }
    const metrics = metricsCollector.getMetrics(window).filter(m => m.name === metricName)
    return metrics.map(m => ({ timestamp: m.timestamp, value: m.value }))
  }

  getTopAgentsByMetric(metric: 'cpu' | 'memory' | 'responseTime', limit = 5): { agentId: string; name: string; value: number }[] {
    const agents = metricsCollector.getAllAgentMetrics()
    let sorted: AgentMetrics[]

    switch (metric) {
      case 'cpu':
        sorted = [...agents].sort((a, b) => b.cpuPercent - a.cpuPercent)
        break
      case 'memory':
        sorted = [...agents].sort((a, b) => b.memoryMB - a.memoryMB)
        break
      case 'responseTime':
        sorted = [...agents].sort((a, b) => b.avgResponseTime - a.avgResponseTime)
        break
      default:
        sorted = agents
    }

    return sorted.slice(0, limit).map(a => ({
      agentId: a.agentId,
      name: a.name,
      value: metric === 'cpu' ? a.cpuPercent : metric === 'memory' ? a.memoryMB : a.avgResponseTime
    }))
  }
}

export const dashboardService = new DashboardService()