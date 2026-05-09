import { Metric, AgentMetrics, AgentStatus, TimeWindow } from './monitorTypes'

const generateId = (): string => Math.random().toString(36).substring(2, 15)

export class MetricsCollector {
  private metrics: Metric[] = []
  private agentMetrics: Map<string, AgentMetrics> = new Map()
  private maxMetrics = 10000

  constructor() {
    // Initialize with default agent metrics
    this.initializeDefaultAgents()
  }

  private initializeDefaultAgents(): void {
    const defaultAgents = ['agent-1', 'agent-2', 'agent-3']
    defaultAgents.forEach(id => {
      this.createAgentMetrics(id, `Agent ${id}`)
    })
  }

  createAgentMetrics(agentId: string, name: string): AgentMetrics {
    const metrics: AgentMetrics = {
      agentId,
      name,
      status: AgentStatus.IDLE,
      uptime: 0,
      cpuPercent: 0,
      memoryMB: 0,
      activeTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      avgResponseTime: 0,
      lastHeartbeat: Date.now(),
      createdAt: Date.now()
    }
    this.agentMetrics.set(agentId, metrics)
    return metrics
  }

  recordMetric(name: string, value: number, unit = '', tags: Record<string, string> = {}): void {
    const metric: Metric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    }

    this.metrics.push(metric)

    // Keep only last maxMetrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  updateAgentMetrics(agentId: string, updates: Partial<AgentMetrics>): void {
    const metrics = this.agentMetrics.get(agentId)
    if (metrics) {
      Object.assign(metrics, updates, { lastHeartbeat: Date.now() })
      if (updates.status === AgentStatus.RUNNING) {
        metrics.uptime += 1
      }
    }
  }

  getAgentMetrics(agentId: string): AgentMetrics | undefined {
    return this.agentMetrics.get(agentId)
  }

  getAllAgentMetrics(): AgentMetrics[] {
    return Array.from(this.agentMetrics.values())
  }

  getMetrics(window?: TimeWindow): Metric[] {
    let filtered = this.metrics

    if (window) {
      filtered = filtered.filter(m => m.timestamp >= window.start && m.timestamp <= window.end)
    }

    return filtered
  }

  getMetricStats(metricName: string, window?: TimeWindow): {
    count: number
    sum: number
    avg: number
    min: number
    max: number
  } {
    const filtered = this.getMetrics(window).filter(m => m.name === metricName)

    if (filtered.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0 }
    }

    const values = filtered.map(m => m.value)
    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    }
  }

  removeAgentMetrics(agentId: string): boolean {
    return this.agentMetrics.delete(agentId)
  }

  clearMetrics(): void {
    this.metrics = []
  }

  // Aggregate metrics by name and tag
  aggregateMetrics(name: string, tagKey?: string): Map<string, number> {
    const filtered = this.metrics.filter(m => m.name === name)
    const aggregated = new Map<string, number>()

    for (const metric of filtered) {
      const key = tagKey ? metric.tags[tagKey] || 'unknown' : 'total'
      aggregated.set(key, (aggregated.get(key) || 0) + metric.value)
    }

    return aggregated
  }

  // Get metrics rate (per second)
  getMetricsRate(metricName: string, windowSeconds: number): number {
    const now = Date.now()
    const window = {
      start: now - windowSeconds * 1000,
      end: now
    }
    const filtered = this.getMetrics(window).filter(m => m.name === metricName)
    return filtered.length / windowSeconds
  }
}

export const metricsCollector = new MetricsCollector()