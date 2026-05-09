// Monitoring Types

export enum AgentStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  BUSY = 'busy',
  ERROR = 'error',
  OFFLINE = 'offline'
}

export enum AlertSeverity {
  WARNING = 'warning',
  CRITICAL = 'critical',
  ERROR = 'error'
}

export enum AlertStatus {
  PENDING = 'pending',
  FIRING = 'firing',
  RESOLVED = 'resolved'
}

export interface Metric {
  name: string
  value: number
  unit: string
  timestamp: number
  tags: Record<string, string>
}

export interface AgentMetrics {
  agentId: string
  name: string
  status: AgentStatus
  uptime: number
  cpuPercent: number
  memoryMB: number
  activeTasks: number
  completedTasks: number
  failedTasks: number
  avgResponseTime: number
  lastHeartbeat: number
  createdAt: number
}

export interface AlertRule {
  id: string
  name: string
  metric: string
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  threshold: number
  severity: AlertSeverity
  enabled: boolean
  cooldownMs: number
  createdAt: number
}

export interface Alert {
  id: string
  ruleId: string
  ruleName: string
  severity: AlertSeverity
  status: AlertStatus
  agentId?: string
  message: string
  currentValue: number
  threshold: number
  timestamp: number
  resolvedAt?: number
}

export interface AlertFilter {
  status?: AlertStatus
  severity?: AlertSeverity
  agentId?: string
  startTime?: number
  endTime?: number
  limit?: number
}

export interface DashboardStats {
  totalAgents: number
  activeAgents: number
  totalTasks: number
  completedTasks: number
  failedTasks: number
  avgCpuUsage: number
  avgMemoryUsage: number
  avgResponseTime: number
  activeAlerts: number
  uptime: number
}

export interface TimeWindow {
  start: number
  end: number
}

export interface DashboardUpdate {
  type: 'metrics' | 'alert' | 'status'
  data: unknown
  timestamp: number
}

// Default alert rules
export const DEFAULT_ALERT_RULES: Omit<AlertRule, 'id' | 'createdAt'>[] = [
  {
    name: 'High CPU Usage',
    metric: 'cpu_percent',
    operator: 'gt',
    threshold: 80,
    severity: AlertSeverity.WARNING,
    enabled: true,
    cooldownMs: 60000
  },
  {
    name: 'Critical CPU Usage',
    metric: 'cpu_percent',
    operator: 'gt',
    threshold: 95,
    severity: AlertSeverity.CRITICAL,
    enabled: true,
    cooldownMs: 30000
  },
  {
    name: 'High Memory Usage',
    metric: 'memory_percent',
    operator: 'gt',
    threshold: 85,
    severity: AlertSeverity.WARNING,
    enabled: true,
    cooldownMs: 60000
  },
  {
    name: 'Agent Offline',
    metric: 'heartbeat_missing',
    operator: 'gt',
    threshold: 1,
    severity: AlertSeverity.ERROR,
    enabled: true,
    cooldownMs: 0
  }
]