/**
 * Role Manager Service
 * 
 * Manages role lifecycle for the multi-agent system.
 * Handles role registration, activation, deactivation, and health monitoring.
 */

import { v4 as uuidv4 } from 'uuid'
import type { ToolResult } from '../types'

export type RoleStatus = 'idle' | 'initializing' | 'ready' | 'busy' | 'error' | 'stopped'
export type RoleType = 'planner' | 'coder' | 'reviewer' | 'executor'

export interface RoleConfig {
  id?: string
  name: string
  type: RoleType
  description?: string
  maxConcurrentTasks: number
  timeout: number
  retryOnFailure: boolean
  maxRetries: number
  capabilities: string[]
  metadata?: Record<string, unknown>
}

export interface Role {
  id: string
  name: string
  type: RoleType
  status: RoleStatus
  config: RoleConfig
  currentTasks: number
  completedTasks: number
  failedTasks: number
  totalExecutionTime: number
  lastActiveAt?: number
  createdAt: number
  error?: string
  health: {
    checkCount: number
    lastCheckAt?: number
    isHealthy: boolean
    consecutiveFailures: number
  }
}

export interface RoleEvent {
  roleId: string
  type: 'created' | 'started' | 'stopped' | 'error' | 'task_assigned' | 'task_completed' | 'health_check'
  timestamp: number
  data?: Record<string, unknown>
}

export interface RoleManagerStats {
  totalRoles: number
  activeRoles: number
  idleRoles: number
  busyRoles: number
  errorRoles: number
  totalTasksCompleted: number
  totalTasksFailed: number
}

const DEFAULT_ROLE_CONFIGS: Record<RoleType, Omit<RoleConfig, 'name' | 'type'>> = {
  planner: {
    maxConcurrentTasks: 2,
    timeout: 60000,
    retryOnFailure: true,
    maxRetries: 3,
    capabilities: ['plan', 'analyze', 'decompose', 'delegate']
  },
  coder: {
    maxConcurrentTasks: 4,
    timeout: 45000,
    retryOnFailure: true,
    maxRetries: 3,
    capabilities: ['write', 'edit', 'delete', 'read', 'execute']
  },
  reviewer: {
    maxConcurrentTasks: 3,
    timeout: 30000,
    retryOnFailure: true,
    maxRetries: 2,
    capabilities: ['review', 'verify', 'approve', 'reject', 'suggest']
  },
  executor: {
    maxConcurrentTasks: 4,
    timeout: 30000,
    retryOnFailure: true,
    maxRetries: 3,
    capabilities: ['execute', 'run', 'build', 'test', 'deploy']
  }
}

export class RoleManager {
  private roles: Map<string, Role> = new Map()
  private roleByType: Map<RoleType, Role[]> = new Map()
  private listeners: Map<string, Array<(event: RoleEvent) => void>> = new Map()
  private healthCheckInterval?: ReturnType<typeof setInterval>
  private healthCheckCallback?: (role: Role) => Promise<boolean>

  constructor() {
    // Initialize role type map
    for (const type of ['planner', 'coder', 'reviewer', 'executor'] as RoleType[]) {
      this.roleByType.set(type, [])
    }
  }

  /**
   * Create a new role
   */
  createRole(config: RoleConfig): Role {
    const id = config.id || `role-${uuidv4()}`
    
    if (this.roles.has(id)) {
      throw new Error(`Role with ID ${id} already exists`)
    }

    const mergedConfig: RoleConfig = {
      ...DEFAULT_ROLE_CONFIGS[config.type],
      ...config,
      id
    }

    const role: Role = {
      id,
      name: config.name,
      type: config.type,
      status: 'idle',
      config: mergedConfig,
      currentTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalExecutionTime: 0,
      createdAt: Date.now(),
      health: {
        checkCount: 0,
        isHealthy: true,
        consecutiveFailures: 0
      }
    }

    this.roles.set(id, role)
    this.roleByType.get(role.type)?.push(role)

    this.emit({
      roleId: id,
      type: 'created',
      timestamp: Date.now()
    })

    return role
  }

  /**
   * Register a role (alias for createRole with full defaults)
   */
  registerRole(name: string, type: RoleType, config?: Partial<RoleConfig>): Role {
    return this.createRole({
      name,
      type,
      ...DEFAULT_ROLE_CONFIGS[type],
      ...config
    })
  }

  /**
   * Get role by ID
   */
  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId)
  }

  /**
   * Get all roles
   */
  getAllRoles(): Role[] {
    return Array.from(this.roles.values())
  }

  /**
   * Get roles by type
   */
  getRolesByType(type: RoleType): Role[] {
    return this.roleByType.get(type) || []
  }

  /**
   * Get available roles (can accept more tasks)
   */
  getAvailableRoles(type?: RoleType): Role[] {
    const roles = type ? this.getRolesByType(type) : this.getAllRoles()
    return roles.filter(r => 
      r.status !== 'stopped' && 
      r.status !== 'error' &&
      r.currentTasks < r.config.maxConcurrentTasks
    )
  }

  /**
   * Update role status
   */
  setRoleStatus(roleId: string, status: RoleStatus, error?: string): boolean {
    const role = this.roles.get(roleId)
    if (!role) return false

    role.status = status
    if (error) role.error = error

    if (status === 'busy') {
      role.lastActiveAt = Date.now()
    }

    this.emit({
      roleId,
      type: status === 'stopped' ? 'stopped' : status === 'error' ? 'error' : 'started',
      timestamp: Date.now(),
      data: { status, error }
    })

    return true
  }

  /**
   * Assign a task to a role
   */
  assignTask(roleId: string): boolean {
    const role = this.roles.get(roleId)
    if (!role) return false

    if (role.currentTasks >= role.config.maxConcurrentTasks) {
      return false
    }

    role.currentTasks++
    role.status = role.currentTasks > 0 ? 'busy' : 'ready'
    role.lastActiveAt = Date.now()

    this.emit({
      roleId,
      type: 'task_assigned',
      timestamp: Date.now(),
      data: { currentTasks: role.currentTasks }
    })

    return true
  }

  /**
   * Complete a task for a role
   */
  completeTask(
    roleId: string, 
    success: boolean, 
    executionTime?: number
  ): boolean {
    const role = this.roles.get(roleId)
    if (!role) return false

    role.currentTasks = Math.max(0, role.currentTasks - 1)
    
    if (executionTime) {
      role.totalExecutionTime += executionTime
    }

    if (success) {
      role.completedTasks++
      role.health.consecutiveFailures = 0
    } else {
      role.failedTasks++
      role.health.consecutiveFailures++
    }

    role.status = role.currentTasks > 0 ? 'busy' : 'ready'

    this.emit({
      roleId,
      type: 'task_completed',
      timestamp: Date.now(),
      data: { success, currentTasks: role.currentTasks }
    })

    return true
  }

  /**
   * Start a role
   */
  startRole(roleId: string): boolean {
    const role = this.roles.get(roleId)
    if (!role || role.status === 'stopped') return false

    role.status = 'initializing'
    
    // Simulate initialization
    setTimeout(() => {
      if (role.status === 'initializing') {
        role.status = 'ready'
        this.emit({
          roleId,
          type: 'started',
          timestamp: Date.now()
        })
      }
    }, 100)

    return true
  }

  /**
   * Stop a role
   */
  stopRole(roleId: string): boolean {
    const role = this.roles.get(roleId)
    if (!role) return false

    role.status = 'stopped'
    role.currentTasks = 0

    this.emit({
      roleId,
      type: 'stopped',
      timestamp: Date.now()
    })

    return true
  }

  /**
   * Remove a role
   */
  removeRole(roleId: string): boolean {
    const role = this.roles.get(roleId)
    if (!role) return false

    this.roles.delete(roleId)
    
    const typeRoles = this.roleByType.get(role.type)
    if (typeRoles) {
      const index = typeRoles.findIndex(r => r.id === roleId)
      if (index !== -1) {
        typeRoles.splice(index, 1)
      }
    }

    return true
  }

  /**
   * Set health check callback
   */
  setHealthCheckCallback(callback: (role: Role) => Promise<boolean>): void {
    this.healthCheckCallback = callback
  }

  /**
   * Start health check loop
   */
  startHealthChecks(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const role of this.roles.values()) {
        if (role.status === 'stopped' || role.status === 'idle') continue

        role.health.checkCount++
        role.health.lastCheckAt = Date.now()

        if (this.healthCheckCallback) {
          try {
            const isHealthy = await this.healthCheckCallback(role)
            role.health.isHealthy = isHealthy

            if (!isHealthy && role.health.consecutiveFailures >= 3) {
              this.setRoleStatus(role.id, 'error', 'Health check failed')
            }
          } catch (error) {
            role.health.isHealthy = false
            role.health.consecutiveFailures++
          }
        }

        this.emit({
          roleId: role.id,
          type: 'health_check',
          timestamp: Date.now(),
          data: { isHealthy: role.health.isHealthy }
        })
      }
    }, intervalMs)
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  /**
   * Subscribe to role events
   */
  on(callback: (event: RoleEvent) => void): () => void {
    const listeners = this.listeners.get('all') || []
    listeners.push(callback)
    this.listeners.set('all', listeners)

    return () => {
      const current = this.listeners.get('all') || []
      this.listeners.set('all', current.filter(cb => cb !== callback))
    }
  }

  /**
   * Emit event
   */
  private emit(event: RoleEvent): void {
    const listeners = this.listeners.get('all') || []
    for (const callback of listeners) {
      try {
        callback(event)
      } catch (error) {
        console.error(`[RoleManager] Event listener error:`, error)
      }
    }
  }

  /**
   * Get statistics
   */
  getStats(): RoleManagerStats {
    let activeRoles = 0
    let idleRoles = 0
    let busyRoles = 0
    let errorRoles = 0
    let totalTasksCompleted = 0
    let totalTasksFailed = 0

    for (const role of this.roles.values()) {
      switch (role.status) {
        case 'ready':
        case 'initializing':
          activeRoles++
          break
        case 'idle':
          idleRoles++
          break
        case 'busy':
          busyRoles++
          activeRoles++
          break
        case 'error':
          errorRoles++
          break
      }
      totalTasksCompleted += role.completedTasks
      totalTasksFailed += role.failedTasks
    }

    return {
      totalRoles: this.roles.size,
      activeRoles,
      idleRoles,
      busyRoles,
      errorRoles,
      totalTasksCompleted,
      totalTasksFailed
    }
  }

  /**
   * Clear all roles
   */
  clear(): void {
    this.stopHealthChecks()
    this.roles.clear()
    for (const type of this.roleByType.values()) {
      type.length = 0
    }
  }
}

// Singleton instance
let roleManagerInstance: RoleManager | null = null

export function getRoleManager(): RoleManager {
  if (!roleManagerInstance) {
    roleManagerInstance = new RoleManager()
  }
  return roleManagerInstance
}

export function initRoleManager(): RoleManager {
  roleManagerInstance = new RoleManager()
  return roleManagerInstance
}