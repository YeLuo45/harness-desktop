import { Alert, AlertRule, AlertFilter, AlertSeverity, AlertStatus, DEFAULT_ALERT_RULES } from './monitorTypes'

const generateId = (): string => Math.random().toString(36).substring(2, 15)

export class AlertManager {
  private rules: Map<string, AlertRule> = new Map()
  private activeAlerts: Map<string, Alert> = new Map()
  private alertHistory: Alert[] = []
  private lastAlertTime: Map<string, number> = new Map()
  private listeners: Set<(alert: Alert) => void> = new Set()
  private maxHistory = 1000

  constructor() {
    this.initializeDefaultRules()
  }

  private initializeDefaultRules(): void {
    DEFAULT_ALERT_RULES.forEach(rule => {
      this.createRule(rule)
    })
  }

  createRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): string {
    const id = generateId()
    const fullRule: AlertRule = {
      ...rule,
      id,
      createdAt: Date.now()
    }
    this.rules.set(id, fullRule)
    return id
  }

  getRule(id: string): AlertRule | undefined {
    return this.rules.get(id)
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values())
  }

  getEnabledRules(): AlertRule[] {
    return Array.from(this.rules.values()).filter(r => r.enabled)
  }

  updateRule(id: string, updates: Partial<AlertRule>): AlertRule | undefined {
    const rule = this.rules.get(id)
    if (!rule) return undefined
    const updated = { ...rule, ...updates, id }
    this.rules.set(id, updated)
    return updated
  }

  deleteRule(id: string): boolean {
    return this.rules.delete(id)
  }

  triggerAlert(
    ruleId: string,
    agentId: string | undefined,
    currentValue: number
  ): Alert | undefined {
    const rule = this.rules.get(ruleId)
    if (!rule || !rule.enabled) return undefined

    // Check cooldown
    const lastTime = this.lastAlertTime.get(ruleId) || 0
    if (Date.now() - lastTime < rule.cooldownMs) {
      return undefined
    }

    // Check condition
    if (!this.evaluateCondition(currentValue, rule.operator, rule.threshold)) {
      return undefined
    }

    const alert: Alert = {
      id: generateId(),
      ruleId,
      ruleName: rule.name,
      severity: rule.severity,
      status: AlertStatus.FIRING,
      agentId,
      message: `${rule.name}: ${currentValue} ${rule.operator} ${rule.threshold}`,
      currentValue,
      threshold: rule.threshold,
      timestamp: Date.now()
    }

    this.activeAlerts.set(alert.id, alert)
    this.lastAlertTime.set(ruleId, Date.now())
    this.listeners.forEach(listener => listener(alert))

    return alert
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold
      case 'lt': return value < threshold
      case 'eq': return value === threshold
      case 'gte': return value >= threshold
      case 'lte': return value <= threshold
      default: return false
    }
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (!alert) return false

    alert.status = AlertStatus.RESOLVED
    alert.resolvedAt = Date.now()
    this.activeAlerts.delete(alertId)
    this.alertHistory.push(alert)

    if (this.alertHistory.length > this.maxHistory) {
      this.alertHistory = this.alertHistory.slice(-this.maxHistory)
    }

    return true
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
  }

  getAlert(id: string): Alert | undefined {
    return this.activeAlerts.get(id) || this.alertHistory.find(a => a.id === id)
  }

  getAlerts(filter?: AlertFilter): Alert[] {
    let results = [...Array.from(this.activeAlerts.values()), ...this.alertHistory]

    if (filter?.status) {
      results = results.filter(a => a.status === filter.status)
    }

    if (filter?.severity) {
      results = results.filter(a => a.severity === filter.severity)
    }

    if (filter?.agentId) {
      results = results.filter(a => a.agentId === filter.agentId)
    }

    if (filter?.startTime) {
      results = results.filter(a => a.timestamp >= filter.startTime!)
    }

    if (filter?.endTime) {
      results = results.filter(a => a.timestamp <= filter.endTime!)
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp)

    if (filter?.limit) {
      results = results.slice(0, filter.limit)
    }

    return results
  }

  subscribe(callback: (alert: Alert) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  getAlertStats(): {
    total: number
    active: number
    resolved: number
    bySeverity: Record<string, number>
  } {
    const all = [...Array.from(this.activeAlerts.values()), ...this.alertHistory]
    const bySeverity: Record<string, number> = {}

    for (const alert of all) {
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1
    }

    return {
      total: all.length,
      active: this.activeAlerts.size,
      resolved: this.alertHistory.length,
      bySeverity
    }
  }

  clearResolved(): void {
    this.alertHistory = []
  }
}

export const alertManager = new AlertManager()