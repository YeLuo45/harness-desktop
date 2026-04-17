import { v4 as uuidv4 } from 'uuid'
import type { SubAgent, SubTask, SubTaskResult, SubAgentResult, KVCacheSnapshot, ToolCall, ToolResult, MemoryPointer } from '../types'

interface SubAgentManagerOptions {
  maxConcurrentAgents?: number
  maxKVCacheSize?: number
  onTaskComplete?: (agentId: string, task: SubTask) => void
  onAgentComplete?: (result: SubAgentResult) => void
}

interface TaskQueueItem {
  task: SubTask
  agentId: string
}

export class SubAgentManager {
  private agents: Map<string, SubAgent> = new Map()
  private taskQueue: TaskQueueItem[] = []
  private runningTasks: Map<string, string> = new Map() // taskId -> agentId
  private maxConcurrentAgents: number
  private maxKVCacheSize: number
  private onTaskComplete?: (agentId: string, task: SubTask) => void
  private onAgentComplete?: (result: SubAgentResult) => void

  // Tool executor callback - will be set by the app
  private toolExecutor: ((toolName: string, args: Record<string, unknown>) => Promise<ToolResult>) | null = null

  constructor(options: SubAgentManagerOptions = {}) {
    this.maxConcurrentAgents = options.maxConcurrentAgents || 4
    this.maxKVCacheSize = options.maxKVCacheSize || 128000
    this.onTaskComplete = options.onTaskComplete
    this.onAgentComplete = options.onAgentComplete
  }

  /**
   * Set the tool executor callback
   */
  setToolExecutor(executor: (toolName: string, args: Record<string, unknown>) => Promise<ToolResult>): void {
    this.toolExecutor = executor
  }

  /**
   * Create a new sub-agent
   */
  createAgent(name: string, parentId?: string): SubAgent {
    const agent: SubAgent = {
      id: uuidv4(),
      name,
      status: 'idle',
      parentId,
      tasks: [],
      kvCache: {
        pointers: [],
        tokenCount: 0,
        maxTokens: this.maxKVCacheSize
      },
      createdAt: Date.now()
    }

    this.agents.set(agent.id, agent)
    return agent
  }

  /**
   * Add a task to an agent
   */
  addTask(agentId: string, description: string, toolCalls: ToolCall[], dependencies: string[] = []): SubTask | null {
    const agent = this.agents.get(agentId)
    if (!agent) return null

    const task: SubTask = {
      id: uuidv4(),
      description,
      toolCalls,
      status: 'idle',
      parentId: agentId,
      dependencies,
      createdAt: Date.now()
    }

    agent.tasks.push(task)
    return task
  }

  /**
   * Add multiple tasks (from a parent task decomposition)
   */
  addTasks(agentId: string, tasks: Array<{ description: string; toolCalls: ToolCall[]; dependencies?: string[] }>): SubTask[] {
    const agent = this.agents.get(agentId)
    if (!agent) return []

    const createdTasks: SubTask[] = []

    for (const taskSpec of tasks) {
      const task: SubTask = {
        id: uuidv4(),
        description: taskSpec.description,
        toolCalls: taskSpec.toolCalls,
        status: 'idle',
        parentId: agentId,
        dependencies: taskSpec.dependencies || [],
        createdAt: Date.now()
      }

      agent.tasks.push(task)
      createdTasks.push(task)
    }

    return createdTasks
  }

  /**
   * Update KV cache for an agent
   */
  updateKVCache(agentId: string, pointers: MemoryPointer[]): void {
    const agent = this.agents.get(agentId)
    if (!agent) return

    // Merge pointers, avoiding duplicates by ID
    const existingIds = new Set(agent.kvCache.pointers.map(p => p.id))
    const newPointers = pointers.filter(p => !existingIds.has(p.id))

    agent.kvCache.pointers.push(...newPointers)

    // Recalculate token count
    let totalTokens = 0
    for (const p of agent.kvCache.pointers) {
      totalTokens += Math.ceil(p.fullContent.length / 4) // Rough estimate
    }
    agent.kvCache.tokenCount = totalTokens

    // Evict old pointers if over limit
    if (agent.kvCache.tokenCount > agent.kvCache.maxTokens) {
      this.evictOldPointers(agent)
    }
  }

  /**
   * Evict oldest pointers to stay within token limit
   */
  private evictOldPointers(agent: SubAgent): void {
    const targetTokens = Math.floor(agent.kvCache.maxTokens * 0.8) // Keep 80% after eviction
    let currentTokens = agent.kvCache.tokenCount

    // Sort by timestamp, oldest first
    agent.kvCache.pointers.sort((a, b) => a.timestamp - b.timestamp)

    while (currentTokens > targetTokens && agent.kvCache.pointers.length > 0) {
      const removed = agent.kvCache.pointers.shift()
      if (removed) {
        currentTokens -= Math.ceil(removed.fullContent.length / 4)
      }
    }

    agent.kvCache.tokenCount = currentTokens
  }

  /**
   * Share KV cache from parent to child agent
   */
  shareKVCacheFromParent(childAgentId: string, parentAgentId: string): boolean {
    const childAgent = this.agents.get(childAgentId)
    const parentAgent = this.agents.get(parentAgentId)

    if (!childAgent || !parentAgent) return false

    // Deep copy parent's pointers
    childAgent.kvCache = {
      pointers: [...parentAgent.kvCache.pointers],
      tokenCount: parentAgent.kvCache.tokenCount,
      maxTokens: this.maxKVCacheSize
    }

    return true
  }

  /**
   * Get an agent's KV cache snapshot
   */
  getKVCacheSnapshot(agentId: string): KVCacheSnapshot | null {
    const agent = this.agents.get(agentId)
    if (!agent) return null

    return {
      pointers: [...agent.kvCache.pointers],
      tokenCount: agent.kvCache.tokenCount,
      maxTokens: agent.kvCache.maxTokens
    }
  }

  /**
   * Get all pending tasks that have no unmet dependencies
   */
  getReadyTasks(agentId: string): SubTask[] {
    const agent = this.agents.get(agentId)
    if (!agent) return []

    return agent.tasks.filter(task => {
      if (task.status !== 'idle') return false

      // Check all dependencies are completed
      for (const depId of task.dependencies) {
        const depTask = agent.tasks.find(t => t.id === depId)
        if (!depTask || depTask.status !== 'completed') {
          return false
        }
      }

      return true
    })
  }

  /**
   * Execute a single task
   */
  async executeTask(agentId: string, taskId: string): Promise<SubTaskResult> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      return { success: false, toolResults: [], output: '', error: 'Agent not found' }
    }

    const task = agent.tasks.find(t => t.id === taskId)
    if (!task) {
      return { success: false, toolResults: [], output: '', error: 'Task not found' }
    }

    if (!this.toolExecutor) {
      return { success: false, toolResults: [], output: '', error: 'Tool executor not set' }
    }

    task.status = 'running'
    task.startedAt = Date.now()

    const toolResults: ToolResult[] = []
    let outputParts: string[] = []

    // Execute each tool call in sequence
    for (const toolCall of task.toolCalls) {
      try {
        const result = await this.toolExecutor(toolCall.name, toolCall.arguments)
        toolResults.push(result)

        if (result.success) {
          outputParts.push(`✓ ${toolCall.name}`)
        } else {
          outputParts.push(`✗ ${toolCall.name}: ${result.error}`)
        }

        // Update KV cache with tool result
        this.updateKVCache(agentId, [{
          id: uuidv4(),
          type: 'tool_result',
          summary: `${toolCall.name}: ${result.success ? 'success' : 'failed'}`,
          fullContent: JSON.stringify({ tool: toolCall.name, args: toolCall.arguments, result: result.result }),
          timestamp: Date.now(),
          associations: []
        }])
      } catch (error: any) {
        toolResults.push({
          toolName: toolCall.name,
          arguments: toolCall.arguments,
          result: null,
          success: false,
          error: error.message,
          timestamp: Date.now()
        })
        outputParts.push(`✗ ${toolCall.name}: ${error.message}`)
      }
    }

    task.status = toolResults.every(r => r.success) ? 'completed' : 'failed'
    task.completedAt = Date.now()
    task.result = {
      success: task.status === 'completed',
      toolResults,
      output: outputParts.join('\n')
    }

    // Callback
    if (this.onTaskComplete) {
      this.onTaskComplete(agentId, task)
    }

    return task.result
  }

  /**
   * Execute all ready tasks for an agent (parallel where possible)
   */
  async executeReadyTasks(agentId: string): Promise<SubTaskResult[]> {
    const readyTasks = this.getReadyTasks(agentId)
    const results: SubTaskResult[] = []

    // Execute tasks in parallel up to maxConcurrentAgents limit
    const batches: SubTask[][] = []
    for (let i = 0; i < readyTasks.length; i += this.maxConcurrentAgents) {
      batches.push(readyTasks.slice(i, i + this.maxConcurrentAgents))
    }

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(task => this.executeTask(agentId, task.id))
      )
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Run an agent to completion
   */
  async runAgent(agentId: string): Promise<SubAgentResult> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      return {
        agentId,
        success: false,
        tasks: [],
        aggregatedOutput: '',
        error: 'Agent not found'
      } as any
    }

    agent.status = 'running'

    // Execute all tasks (handling dependencies)
    const allTaskResults: SubTaskResult[] = []
    let iterations = 0
    const maxIterations = agent.tasks.length * 2 // Safety limit

    while (iterations < maxIterations) {
      const readyTasks = this.getReadyTasks(agentId)

      if (readyTasks.length === 0) {
        // Check if we're done or stuck
        const pendingTasks = agent.tasks.filter(t => t.status === 'idle')
        if (pendingTasks.length === 0) break

        // Find tasks with failed dependencies
        const stuckTasks = pendingTasks.filter(t => {
          return t.dependencies.some(depId => {
            const dep = agent.tasks.find(d => d.id === depId)
            return dep?.status === 'failed'
          })
        })

        if (stuckTasks.length > 0) {
          // Mark stuck tasks as failed
          for (const task of stuckTasks) {
            task.status = 'failed'
            task.result = {
              success: false,
              toolResults: [],
              output: '',
              error: 'Dependency failed'
            }
            allTaskResults.push(task.result)
          }
          break
        }
      }

      const results = await this.executeReadyTasks(agentId)
      allTaskResults.push(...results)
      iterations++
    }

    // Determine overall success
    const allSucceeded = agent.tasks.every(t => t.status === 'completed')

    // Aggregate outputs
    const aggregatedOutput = agent.tasks
      .filter(t => t.result)
      .map(t => `[${t.description}]: ${t.result!.output}`)
      .join('\n\n')

    agent.status = allSucceeded ? 'completed' : 'failed'
    agent.completedAt = Date.now()

    const result: SubAgentResult = {
      agentId,
      success: allSucceeded,
      tasks: allTaskResults,
      aggregatedOutput,
      kvCacheSnapshot: this.getKVCacheSnapshot(agentId)!
    }

    if (this.onAgentComplete) {
      this.onAgentComplete(result)
    }

    return result
  }

  /**
   * Cancel an agent and its tasks
   */
  cancelAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId)
    if (!agent) return false

    agent.status = 'cancelled'

    // Cancel running and pending tasks
    for (const task of agent.tasks) {
      if (task.status === 'idle' || task.status === 'running') {
        task.status = 'cancelled'
      }
    }

    return true
  }

  /**
   * Get agent status
   */
  getAgent(agentId: string): SubAgent | undefined {
    return this.agents.get(agentId)
  }

  /**
   * Get all agents
   */
  getAllAgents(): SubAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Clear completed agents to free memory
   */
  clearCompletedAgents(): number {
    let cleared = 0

    for (const [id, agent] of this.agents) {
      if (agent.status === 'completed' || agent.status === 'failed' || agent.status === 'cancelled') {
        // Don't clear if there are child agents depending on this
        const hasActiveChildren = Array.from(this.agents.values()).some(
          a => a.parentId === id && ['running', 'idle'].includes(a.status)
        )

        if (!hasActiveChildren) {
          this.agents.delete(id)
          cleared++
        }
      }
    }

    return cleared
  }

  /**
   * Get aggregate statistics
   */
  getStats(): {
    totalAgents: number
    runningAgents: number
    completedAgents: number
    failedAgents: number
    pendingTasks: number
    runningTasks: number
    completedTasks: number
  } {
    let runningAgents = 0
    let completedAgents = 0
    let failedAgents = 0
    let pendingTasks = 0
    let runningTasks = 0
    let completedTasks = 0

    for (const agent of this.agents.values()) {
      switch (agent.status) {
        case 'running': runningAgents++; break
        case 'completed': completedAgents++; break
        case 'failed': failedAgents++; break
      }

      for (const task of agent.tasks) {
        switch (task.status) {
          case 'idle': pendingTasks++; break
          case 'running': runningTasks++; break
          case 'completed': completedTasks++; break
        }
      }
    }

    return {
      totalAgents: this.agents.size,
      runningAgents,
      completedAgents,
      failedAgents,
      pendingTasks,
      runningTasks,
      completedTasks
    }
  }
}

// Singleton
let subAgentManagerInstance: SubAgentManager | null = null

export function getSubAgentManager(): SubAgentManager {
  if (!subAgentManagerInstance) {
    subAgentManagerInstance = new SubAgentManager({
      maxConcurrentAgents: 4,
      maxKVCacheSize: 128000
    })
  }
  return subAgentManagerInstance
}

export function initSubAgentManager(options?: SubAgentManagerOptions): SubAgentManager {
  subAgentManagerInstance = new SubAgentManager(options)
  return subAgentManagerInstance
}
