/**
 * Multi-Agent Engine Service
 * 
 * Core role-based scheduling engine for unattended multi-agent processing.
 * Replaces stub implementation with real role orchestration.
 */

import { v4 as uuidv4 } from 'uuid'
import type { ToolCall, ToolResult, SubAgent, SubAgentResult, SubTask, MemoryPointer } from '../types'
import { SubAgentManager } from './subAgentManager'
import { TaskQueue, getTaskQueue, type QueuedTask, type TaskPriority } from './taskQueue'
import { MessageBus, getMessageBus, type AgentMessage } from './messageBus'
import { RoleManager, getRoleManager, type Role, type RoleType, type RoleConfig } from './roleManager'
import { getRoleStore, type StoredRoleConfig } from '../store/roleStore'

export type UnattendedTaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface UnattendedTask {
  id: string
  description: string
  toolCalls: ToolCall[]
  priority: TaskPriority
  status: UnattendedTaskStatus
  createdAt: number
  startedAt?: number
  completedAt?: number
  retryCount: number
  maxRetries: number
  assignedRoleId?: string
  result?: SubAgentResult
  error?: string
  dependencies: string[] // Task IDs that must complete before this task
}

export interface EngineConfig {
  maxConcurrentTasks: number
  maxRetries: number
  defaultTimeout: number
  enableRoleScheduling: boolean
  enableMessageBus: boolean
}

const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  maxConcurrentTasks: 4,
  maxRetries: 3,
  defaultTimeout: 60000,
  enableRoleScheduling: true,
  enableMessageBus: true
}

// Message types for inter-role communication
export const MESSAGE_TYPES = {
  TASK_ASSIGNED: 'task:assigned',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  ROLE_STATUS: 'role:status',
  RESULT_AGGREGATED: 'result:aggregated',
  ENGINE_STATUS: 'engine:status'
} as const

export class MultiAgentEngine {
  private config: EngineConfig
  private taskQueue: TaskQueue
  private messageBus: MessageBus
  private roleManager: RoleManager
  private subAgentManager: SubAgentManager
  private unattendedTasks: Map<string, UnattendedTask> = new Map()
  private runningTasks: Map<string, string> = new Map() // taskId -> roleId
  private completedTasks: Map<string, UnattendedTask> = new Map()
  private toolExecutor: ((toolName: string, args: Record<string, unknown>) => Promise<ToolResult>) | null = null
  private isRunning = false
  private processInterval?: ReturnType<typeof setInterval>
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map()

  constructor(options?: Partial<EngineConfig> & { taskQueue?: TaskQueue; messageBus?: MessageBus; roleManager?: RoleManager; subAgentManager?: SubAgentManager }) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...options }
    
    // Use provided instances or get singleton
    this.taskQueue = options?.taskQueue || getTaskQueue()
    this.messageBus = options?.messageBus || getMessageBus()
    this.roleManager = options?.roleManager || getRoleManager()
    this.subAgentManager = options?.subAgentManager || new SubAgentManager({
      maxConcurrentAgents: this.config.maxConcurrentTasks * 2
    })
  }

  /**
   * Initialize the engine with default role configurations
   */
  async initialize(): Promise<void> {
    // Initialize role store and load/create default roles
    try {
      const roleStore = getRoleStore()
      await roleStore.initializeDefaultRoles()
      
      // Register roles from store
      const storedRoles = await roleStore.loadRoles()
      for (const stored of storedRoles) {
        if (stored.enabled) {
          this.roleManager.registerRole(stored.name, stored.type, stored.config)
        }
      }
    } catch (error) {
      console.warn('[MultiAgentEngine] Role store initialization skipped:', error)
    }

    // Start health checks
    this.roleManager.startHealthChecks(30000)

    // Set up message bus subscriptions for inter-role communication
    this.setupMessageBusSubscriptions()
  }

  /**
   * Set up message bus subscriptions
   */
  private setupMessageBusSubscriptions(): void {
    if (!this.config.enableMessageBus) return

    // Subscribe to all role messages
    this.messageBus.subscribe((message) => {
      console.log(`[MultiAgentEngine] Message: ${message.type} from ${message.fromRole} to ${message.toRole}`)
    }, { messageType: '*' })
  }

  /**
   * Set tool executor callback
   */
  setToolExecutor(executor: (toolName: string, args: Record<string, unknown>) => Promise<ToolResult>): void {
    this.toolExecutor = executor
    this.subAgentManager.setToolExecutor(executor)
  }

  /**
   * Submit an unattended task
   */
  async submitTask(
    description: string,
    toolCalls: ToolCall[],
    options?: {
      priority?: TaskPriority
      timeout?: number
      maxRetries?: number
      dependencies?: string[]
      assignedRoleType?: RoleType
    }
  ): Promise<string> {
    const id = ` unattended-${uuidv4()}`

    const task: UnattendedTask = {
      id,
      description,
      toolCalls,
      priority: options?.priority || 'normal',
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options?.maxRetries ?? this.config.maxRetries,
      dependencies: options?.dependencies || [],
      assignedRoleId: undefined
    }

    this.unattendedTasks.set(id, task)

    // Add to queue
    this.taskQueue.enqueue('unattended', { taskId: id, toolCalls, description }, {
      priority: task.priority,
      timeout: options?.timeout ?? this.config.defaultTimeout,
      maxRetries: task.maxRetries,
      metadata: { taskId: id, assignedRoleType: options?.assignedRoleType }
    })

    this.emit('task:submitted', { taskId: id, description })

    // Start processing if not running
    if (!this.isRunning) {
      this.start()
    }

    return id
  }

  /**
   * Start the engine processing loop
   */
  start(): void {
    if (this.isRunning) return
    this.isRunning = true

    // Initialize roles
    for (const role of this.roleManager.getAllRoles()) {
      this.roleManager.startRole(role.id)
    }

    // Start processing interval
    this.processInterval = setInterval(() => {
      this.processQueue()
    }, 100)
  }

  /**
   * Stop the engine
   */
  stop(): void {
    this.isRunning = false
    if (this.processInterval) {
      clearInterval(this.processInterval)
      this.processInterval = undefined
    }
    this.emit('engine:stopped', {})
  }

  /**
   * Process queue and dispatch tasks to roles
   */
  private async processQueue(): Promise<void> {
    if (!this.isRunning) return

    // Check for tasks to start
    const pending = this.taskQueue.getPendingTasks()
    
    for (const queued of pending) {
      if (this.runningTasks.size >= this.config.maxConcurrentTasks) break

      const taskId = (queued.metadata as { taskId?: string })?.taskId
      if (!taskId) continue

      const task = this.unattendedTasks.get(taskId)
      if (!task || task.status !== 'pending') continue

      // Check dependencies
      if (!this.checkDependencies(task)) continue

      // Assign to available role
      const roleType = (queued.metadata as { assignedRoleType?: RoleType })?.assignedRoleType
      const role = this.findAvailableRole(roleType)

      if (!role) {
        // No available role, wait
        break
      }

      // Start task
      if (this.taskQueue.startTask(queued.id)) {
        task.status = 'running'
        task.startedAt = Date.now()
        task.assignedRoleId = role.id
        this.runningTasks.set(taskId, role.id)

        // Assign to role
        this.roleManager.assignTask(role.id)

        // Execute task
        this.executeTask(task, role).catch(error => {
          console.error(`[MultiAgentEngine] Task ${taskId} failed:`, error)
        })
      }
    }
  }

  /**
   * Check if task dependencies are met
   */
  private checkDependencies(task: UnattendedTask): boolean {
    if (task.dependencies.length === 0) return true

    for (const depId of task.dependencies) {
      const depTask = this.unattendedTasks.get(depId)
      if (!depTask) continue
      if (depTask.status !== 'completed' && depTask.status !== 'failed') {
        return false
      }
    }
    return true
  }

  /**
   * Find an available role
   */
  private findAvailableRole(preferredType?: RoleType): Role | undefined {
    const available = this.roleManager.getAvailableRoles()
    
    if (preferredType) {
      const preferred = available.find(r => r.type === preferredType)
      if (preferred) return preferred
    }

    // Round-robin among available roles
    return available[0]
  }

  /**
   * Execute a task using assigned role
   */
  private async executeTask(task: UnattendedTask, role: Role): Promise<void> {
    const startTime = Date.now()
    const roleId = role.id

    // Create sub-agent for this task
    const agent = this.subAgentManager.createAgent(`task-${task.id}`, roleId)

    // Share KV cache from parent if available
    const parentAgent = this.subAgentManager.getAgent(roleId)
    if (parentAgent) {
      this.subAgentManager.shareKVCacheFromParent(agent.id, roleId)
    }

    // Add tasks to agent
    this.subAgentManager.addTask(agent.id, task.description, task.toolCalls, task.dependencies)

    // Run agent
    let result: SubAgentResult
    try {
      result = await this.subAgentManager.runAgent(agent.id)
    } catch (error) {
      result = {
        agentId: agent.id,
        success: false,
        tasks: [],
        aggregatedOutput: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    const executionTime = Date.now() - startTime

    // Update task status
    if (result.success) {
      task.status = 'completed'
      task.result = result
      this.taskQueue.completeTask(task.id, result)
    } else {
      // Check retry
      const { retried } = this.taskQueue.failTask(task.id, result.error || 'Task failed')
      
      if (retried) {
        task.retryCount++
        task.status = 'pending'
      } else {
        task.status = 'failed'
        task.error = result.error
      }
    }

    task.completedAt = Date.now()

    // Release role
    this.roleManager.completeTask(roleId, result.success, executionTime)

    // Clean up
    this.runningTasks.delete(task.id)

    // Notify via message bus
    if (this.config.enableMessageBus) {
      this.messageBus.publish(role.type, MESSAGE_TYPES.TASK_COMPLETED, {
        taskId: task.id,
        success: result.success,
        roleId
      })
    }

    this.emit('task:completed', { taskId: task.id, success: result.success, executionTime })

    // Check if task should be removed from active map
    if (task.status === 'completed' || task.status === 'failed') {
      this.completedTasks.set(task.id, task)
      this.unattendedTasks.delete(task.id)
    }
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.unattendedTasks.get(taskId)
    if (!task) return false

    // If running, cancel the role's assignment
    if (task.status === 'running' && task.assignedRoleId) {
      this.roleManager.completeTask(task.assignedRoleId, false)
      this.runningTasks.delete(taskId)
    }

    task.status = 'cancelled'
    this.taskQueue.cancel(taskId)
    this.unattendedTasks.delete(taskId)
    this.completedTasks.set(taskId, task)

    this.emit('task:cancelled', { taskId })
    return true
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): UnattendedTaskStatus | undefined {
    return this.unattendedTasks.get(taskId)?.status || this.completedTasks.get(taskId)?.status
  }

  /**
   * Get task result
   */
  getTaskResult(taskId: string): SubAgentResult | undefined {
    return this.unattendedTasks.get(taskId)?.result || this.completedTasks.get(taskId)?.result
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): UnattendedTask[] {
    return Array.from(this.unattendedTasks.values())
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): UnattendedTask[] {
    return Array.from(this.completedTasks.values())
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeTasks: number
    completedTasks: number
    runningTasks: number
    roleStats: ReturnType<RoleManager['getStats']>
    queueStats: ReturnType<TaskQueue['getStats']>
  } {
    return {
      activeTasks: this.unattendedTasks.size,
      completedTasks: this.completedTasks.size,
      runningTasks: this.runningTasks.size,
      roleStats: this.roleManager.getStats(),
      queueStats: this.taskQueue.getStats()
    }
  }

  /**
   * Register event listener
   */
  on(event: string, callback: (data: unknown) => void): () => void {
    const listeners = this.listeners.get(event) || []
    listeners.push(callback)
    this.listeners.set(event, listeners)

    return () => {
      const current = this.listeners.get(event) || []
      this.listeners.set(event, current.filter(cb => cb !== callback))
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data: unknown): void {
    const listeners = this.listeners.get(event) || []
    for (const callback of listeners) {
      try {
        callback(data)
      } catch (error) {
        console.error(`[MultiAgentEngine] Event listener error (${event}):`, error)
      }
    }
  }

  /**
   * Get all registered roles
   */
  getRoles(): Role[] {
    return this.roleManager.getAllRoles()
  }

  /**
   * Get role by ID
   */
  getRole(roleId: string): Role | undefined {
    return this.roleManager.getRole(roleId)
  }

  /**
   * Update role configuration
   */
  async updateRoleConfig(roleId: string, config: Partial<RoleConfig>): Promise<boolean> {
    const role = this.roleManager.getRole(roleId)
    if (!role) return false

    // Update in store
    try {
      const roleStore = getRoleStore()
      await roleStore.updateRoleConfig(roleId, config)
    } catch (error) {
      console.warn('[MultiAgentEngine] Failed to update role in store:', error)
    }

    return true
  }

  /**
   * Clear completed tasks
   */
  clearCompletedTasks(): void {
    this.completedTasks.clear()
    this.taskQueue.clearHistory()
  }
}

// Singleton instance
let engineInstance: MultiAgentEngine | null = null

export function getMultiAgentEngine(): MultiAgentEngine | null {
  return engineInstance
}

export function initMultiAgentEngine(options?: Partial<EngineConfig>): MultiAgentEngine {
  engineInstance = new MultiAgentEngine(options)
  return engineInstance
}