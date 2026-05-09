import { AuditLog, AuditFilter } from './securityTypes'

const STORAGE_KEY = 'security_audit_logs'
const MAX_LOGS = 10000

const generateId = (): string => Math.random().toString(36).substring(2, 15)

export class AuditLogger {
  private logs: AuditLog[] = []
  private listeners: Set<(log: AuditLog) => void> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        this.logs = JSON.parse(data)
      }
    } catch (e) {
      console.warn('Failed to load audit logs:', e)
      this.logs = []
    }
  }

  private saveToStorage(): void {
    try {
      // Keep only last MAX_LOGS entries
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs))
    } catch (e) {
      console.warn('Failed to save audit logs:', e)
    }
  }

  log(
    userId: string,
    username: string | undefined,
    action: string,
    resource: string,
    result: 'success' | 'failure',
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): AuditLog {
    const auditLog: AuditLog = {
      id: generateId(),
      timestamp: Date.now(),
      userId,
      username,
      action,
      resource,
      result,
      details,
      ipAddress,
      userAgent
    }

    this.logs.push(auditLog)
    this.saveToStorage()

    // Notify listeners
    this.listeners.forEach(listener => listener(auditLog))

    return auditLog
  }

  query(filter: AuditFilter): AuditLog[] {
    let results = [...this.logs]

    if (filter.startTime) {
      results = results.filter(l => l.timestamp >= filter.startTime!)
    }

    if (filter.endTime) {
      results = results.filter(l => l.timestamp <= filter.endTime!)
    }

    if (filter.userId) {
      results = results.filter(l => l.userId === filter.userId)
    }

    if (filter.action) {
      results = results.filter(l => l.action === filter.action)
    }

    if (filter.resource) {
      results = results.filter(l => l.resource === filter.resource)
    }

    if (filter.result) {
      results = results.filter(l => l.result === filter.result)
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp)

    // Apply pagination
    if (filter.offset) {
      results = results.slice(filter.offset)
    }

    if (filter.limit) {
      results = results.slice(0, filter.limit)
    }

    return results
  }

  export(filter: AuditFilter): string {
    const logs = this.query({ ...filter, limit: MAX_LOGS })
    const csv = [
      'ID,Timestamp,UserID,Username,Action,Resource,ResourceID,Result,IP Address,User Agent,Details',
      ...logs.map(l =>
        [
          l.id,
          new Date(l.timestamp).toISOString(),
          l.userId,
          l.username || '',
          l.action,
          l.resource,
          l.resourceId || '',
          l.result,
          l.ipAddress || '',
          l.userAgent || '',
          JSON.stringify(l.details || {})
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n')

    return csv
  }

  getStats(): { total: number; success: number; failure: number; byAction: Record<string, number> } {
    const stats = {
      total: this.logs.length,
      success: 0,
      failure: 0,
      byAction: {} as Record<string, number>
    }

    for (const log of this.logs) {
      if (log.result === 'success') stats.success++
      else stats.failure++

      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1
    }

    return stats
  }

  clear(): void {
    this.logs = []
    this.saveToStorage()
  }

  subscribe(listener: (log: AuditLog) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // Convenience methods for common actions
  logAgentCreated(userId: string, username: string | undefined, agentId: string): AuditLog {
    return this.log(userId, username, 'agent:create', 'agent', 'success', { agentId })
  }

  logAgentDeleted(userId: string, username: string | undefined, agentId: string): AuditLog {
    return this.log(userId, username, 'agent:delete', 'agent', 'success', { agentId })
  }

  logWorkflowExecuted(userId: string, username: string | undefined, workflowId: string, result: 'success' | 'failure'): AuditLog {
    return this.log(userId, username, 'workflow:execute', 'workflow', result, { workflowId })
  }

  logPermissionDenied(userId: string, username: string | undefined, permission: string): AuditLog {
    return this.log(userId, username, 'permission:denied', 'permission', 'failure', { permission })
  }
}

export const auditLogger = new AuditLogger()
