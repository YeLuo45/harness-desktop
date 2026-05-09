// Monitoring - barrel export

export * from './monitorTypes'
export { MetricsCollector, metricsCollector } from './metricsCollector'
export { AlertManager, alertManager } from './alertManager'
export { DashboardService, dashboardService } from './dashboardService'

/*
Quick Start:

import { metricsCollector, alertManager, dashboardService, AgentStatus } from './monitoring'

// Record metrics
metricsCollector.recordMetric('cpu_percent', 45.2, '%', { agentId: 'agent-1' })
metricsCollector.recordMetric('memory_percent', 62.8, '%', { agentId: 'agent-1' })

// Update agent metrics
metricsCollector.updateAgentMetrics('agent-1', {
  status: AgentStatus.RUNNING,
  cpuPercent: 50,
  memoryMB: 256
})

// Create alert rule
const ruleId = alertManager.createRule({
  name: 'High Memory',
  metric: 'memory_percent',
  operator: 'gt',
  threshold: 90,
  severity: 'critical',
  enabled: true,
  cooldownMs: 60000
})

// Get dashboard stats
const stats = dashboardService.getDashboardStats()

// Subscribe to updates
const unsubscribe = dashboardService.subscribe(update => {
  console.log('Dashboard update:', update)
})
*/