import { v4 as uuidv4 } from 'uuid'
import type { SubAgent, SubTask, SubTaskResult, SubAgentResult, KVCacheSnapshot, ToolCall, ToolResult, MemoryPointer, AgentRole } from '../types'
import { getToolRegistry, type ToolRegistry } from './tools'
import { getDelegationStore, type DelegationStore } from './persistence'
import type { DelegationState } from './persistence/types'
import { Orchestrator, orchestrator, type ExecutionPlan, type ExecutionStep } from './multiAgent/orchestrator'
import { ResultAggregator, resultAggregator } from './multiAgent/resultAggregator'

interface SubAgentManagerOptions {
  maxConcurrentAgents?: number
  maxKVCacheSize?: number
  onTaskComplete?: (agentId: string, task: SubTask) => void
  onAgentComplete?: (result: SubAgentResult) => void
  delegationStore?: DelegationStore
  enableOrchestration?: boolean
  aggregationStrategy?: 'sequential' | 'hierarchical' | 'consensus' | 'vote'
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
  private delegationStore: DelegationStore

  // Orchestrator integration for multi-agent collaboration
  private orchestrator: Orchestrator
  private resultAggregator: ResultAggregator
  private enableOrchestration: boolean
  private aggregationStrategy: 'sequential' | 'hierarchical' | 'consensus' | 'vote'
  private executionPlans: Map<string, ExecutionPlan> = new Map() // sessionId -> plan
  private completedSteps: Map<string, Set<string>> = new Map() // sessionId -> completed stepIds

  // Tool executor callback - will be set by the app
  private toolExecutor: ((toolName: string, args: Record<string, unknown>) => Promise<ToolResult>) | null = null

  constructor(options: SubAgentManagerOptions = {}) {
    this.maxConcurrentAgents = options.maxConcurrentAgents || 4
    this.maxKVCacheSize = options.maxKVCacheSize || 128000
    this.onTaskComplete = options.onTaskComplete
    this.onAgentComplete = options.onAgentComplete
    this.delegationStore = options.delegationStore || getDelegationStore()
    this.enableOrchestration = options.enableOrchestration ?? true
    this.aggregationStrategy = options.aggregationStrategy || 'sequential'
    this.orchestrator = orchestrator
    this.resultAggregator = resultAggregator
  }

  /**
   * Initialize the sub-agent manager and recover pending/in_progress delegations
   */
  async initialize(): Promise<void> {
    await this.recoverDelegations()
  }

  /**
   * Save delegation state to disk (for a specific agent's delegation)
   */
  private async saveDelegation(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) return

    const delegation: DelegationState = {
      id: `delegation_${agentId}`,
      delegatorId: agent.parentId || 'system',
      delegateId: agentId,
      scope: [],
      permissions: [],
      status: agent.status === 'running' ? 'active' : 
              agent.status === 'idle' ? 'pending' : 
              agent.status === 'completed' ? 'completed' : 
              agent.status === 'failed' ? 'failed' : 'pending',
      createdAt: agent.createdAt,
      updatedAt: Date.now(),
      expiresAt: undefined,
      metadata: {
        agentName: agent.name,
        taskCount: agent.tasks.length,
        tasks: agent.tasks.map(t => ({
          id: t.id,
          description: t.description,
          status: t.status,
          dependencies: t.dependencies
        }))
      }
    }

    await this.delegationStore.save(delegation)
  }

  /**
   * Recover pending/in_progress delegations from disk
   */
  async recoverDelegations(): Promise<void> {
    try {
      const delegations = await this.delegationStore.list()
      const recoverableStatuses = ['pending', 'active', 'in_progress']

      for (const delegation of delegations) {
        if (recoverableStatuses.includes(delegation.status)) {
          // Reconstruct agent from delegation metadata
          if (delegation.metadata && typeof delegation.metadata === 'object') {
            const meta = delegation.metadata as Record<string, unknown>
            const agent: SubAgent = {
              id: delegation.delegateId,
              name: (meta.agentName as string) || 'recovered_agent',
              status: delegation.status === 'active' ? 'running' : 
                      delegation.status === 'completed' ? 'completed' :
                      delegation.status === 'failed' ? 'failed' : 'idle',
              parentId: delegation.delegatorId !== 'system' ? delegation.delegatorId : undefined,
              tasks: (meta.tasks as Array<{
                id: string
                description: string
                status: string
                dependencies: string[]
              }>)?.map(t => ({
                id: t.id,
                description: t.description,
                toolCalls: [],
                status: t.status as 'idle' | 'running' | 'completed' | 'failed' | 'cancelled',
                parentId: delegation.delegateId,
                dependencies: t.dependencies,
                createdAt: delegation.createdAt
              })) || [],
              kvCache: {
                pointers: [],
                tokenCount: 0,
                maxTokens: this.maxKVCacheSize
              },
              createdAt: delegation.createdAt
            }

            this.agents.set(agent.id, agent)
            console.log(`[SubAgentManager] Recovered agent: ${agent.id} with ${agent.tasks.length} tasks`)
          }
        }
      }
    } catch (error) {
      console.warn('[SubAgentManager] Failed to recover delegations:', error)
    }
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
    
    // Auto-save to disk
    this.saveDelegation(agent.id).catch(err => {
      console.warn(`[SubAgentManager] Failed to save delegation for agent ${agent.id}:`, err)
    })
    
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
    
    // Auto-save to disk
    this.saveDelegation(agentId).catch(err => {
      console.warn(`[SubAgentManager] Failed to save delegation for agent ${agentId}:`, err)
    })
    
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

    // Auto-save to disk
    this.saveDelegation(agentId).catch(err => {
      console.warn(`[SubAgentManager] Failed to save delegation for agent ${agentId}:`, err)
    })

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

      // Check all dependencies are completed (may span across agents)
      for (const depId of task.dependencies) {
        const depTask = this.findTaskById(depId)
        if (!depTask || depTask.status !== 'completed') {
          return false
        }
      }

      return true
    })
  }

  /**
   * Find a task by ID across all agents
   */
  private findTaskById(taskId: string): SubTask | undefined {
    const agentsArray = Array.from(this.agents.values())
    for (const agent of agentsArray) {
      const task = agent.tasks.find(t => t.id === taskId)
      if (task) return task
    }
    return undefined
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

    // Auto-save to disk
    this.saveDelegation(agentId).catch(err => {
      console.warn(`[SubAgentManager] Failed to save delegation for agent ${agentId}:`, err)
    })

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

    const taskFailed = !toolResults.every(r => r.success)
    task.status = taskFailed ? 'failed' : 'completed'
    task.completedAt = Date.now()

    const firstError = toolResults.find(r => !r.success)?.error
    task.result = {
      success: !taskFailed,
      toolResults,
      output: outputParts.join('\n'),
      error: taskFailed ? (firstError || 'Task failed') : undefined
    }

    // Auto-save to disk after task completion
    this.saveDelegation(agentId).catch(err => {
      console.warn(`[SubAgentManager] Failed to save delegation for agent ${agentId}:`, err)
    })

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

    // Auto-save to disk
    this.saveDelegation(agentId).catch(err => {
      console.warn(`[SubAgentManager] Failed to save delegation for agent ${agentId}:`, err)
    })

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

    // Auto-save to disk after agent completion
    this.saveDelegation(agentId).catch(err => {
      console.warn(`[SubAgentManager] Failed to save delegation for agent ${agentId}:`, err)
    })

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

    // Auto-save to disk after cancellation
    this.saveDelegation(agentId).catch(err => {
      console.warn(`[SubAgentManager] Failed to save delegation for agent ${agentId}:`, err)
    })

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
    const agentsArray = Array.from(this.agents.entries())

    for (const [id, agent] of agentsArray) {
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

  // ========== Orchestrator Integration Methods ==========

  /**
   * Create an orchestration plan for multi-agent collaboration
   */
  createOrchestrationPlan(orchestratorAgentId: string): ExecutionPlan | null {
    if (!this.enableOrchestration) return null

    const orchestratorAgent = this.agents.get(orchestratorAgentId)
    if (!orchestratorAgent) return null

    // Get all child agents (workers)
    const childAgents = Array.from(this.agents.values()).filter(
      a => a.parentId === orchestratorAgentId && a.status !== 'cancelled'
    )

    // Get all tasks from orchestrator and child agents
    const allTasks = [...orchestratorAgent.tasks]
    for (const agent of childAgents) {
      allTasks.push(...agent.tasks)
    }

    if (allTasks.length === 0) return null

    // Create a mock collaboration session for the orchestrator
    const agentsMap = new Map<string, any>()
    agentsMap.set(orchestratorAgentId, { id: orchestratorAgentId, config: { role: 'orchestrator' } })
    for (const agent of childAgents) {
      agentsMap.set(agent.id, { id: agent.id, config: { role: 'orchestrator' } })
    }

    const mockSession = {
      id: orchestratorAgentId,
      name: orchestratorAgent.name,
      agents: agentsMap,
      tasks: allTasks.map(t => ({
        id: t.id,
        description: t.description,
        dependencies: t.dependencies,
        status: t.status
      }))
    }

    // Create execution plan using Orchestrator
    const plan = this.orchestrator.createExecutionPlan(mockSession as any)
    this.executionPlans.set(orchestratorAgentId, plan)
    this.completedSteps.set(orchestratorAgentId, new Set())

    return plan
  }

  /**
   * Get next executable steps from an orchestration plan
   */
  getNextExecutableSteps(orchestratorAgentId: string): ExecutionStep[] {
    const plan = this.executionPlans.get(orchestratorAgentId)
    const completed = this.completedSteps.get(orchestratorAgentId)

    if (!plan || !completed) return []

    return this.orchestrator.getNextExecutableSteps(plan, completed)
  }

  /**
   * Mark a step as completed in the orchestration plan
   */
  markStepCompleted(orchestratorAgentId: string, stepId: string): void {
    const completed = this.completedSteps.get(orchestratorAgentId)
    if (completed) {
      completed.add(stepId)
    }
  }

  /**
   * Execute all agents with orchestration support
   * Uses the Orchestrator to determine parallel execution groups
   */
  async runWithOrchestration(orchestratorAgentId: string): Promise<SubAgentResult> {
    const orchestratorAgent = this.agents.get(orchestratorAgentId)
    if (!orchestratorAgent) {
      return {
        agentId: orchestratorAgentId,
        success: false,
        tasks: [],
        aggregatedOutput: '',
        error: 'Orchestrator agent not found'
      }
    }

    // Create orchestration plan if not exists
    let plan = this.executionPlans.get(orchestratorAgentId)
    if (!plan) {
      plan = this.createOrchestrationPlan(orchestratorAgentId) ?? undefined
    }

    if (!plan) {
      // Fallback to regular execution
      return this.runAgent(orchestratorAgentId)
    }

    orchestratorAgent.status = 'running'
    this.saveDelegation(orchestratorAgentId).catch(err => {
      console.warn(`[SubAgentManager] Failed to save delegation:`, err)
    })

    const allTaskResults: SubTaskResult[] = []
    const completed = this.completedSteps.get(orchestratorAgentId) || new Set()
    const planSteps = plan.steps

    // Execute steps in parallel groups according to plan
    for (const step of planSteps) {
      // Wait for dependencies
      if (step.waitFor && step.waitFor.length > 0) {
        const depsCompleted = step.waitFor.every(depId => completed.has(depId))
        if (!depsCompleted) {
          // Skip this step for now - dependencies not met
          continue
        }
      }

      // Execute the step
      const task = this.findTaskById(step.taskId)
      if (!task) continue

      const agentId = step.agentId
      const taskResult = await this.executeTask(agentId, task.id)
      allTaskResults.push(taskResult)
      completed.add(step.stepId)

      // Update orchestrator's KV cache with task result
      if (taskResult.toolResults) {
        this.updateKVCache(orchestratorAgentId, taskResult.toolResults.map(r => ({
          id: uuidv4(),
          type: 'tool_result' as const,
          summary: `Result from ${agentId}: ${r.success ? 'success' : 'failed'}`,
          fullContent: JSON.stringify(r),
          timestamp: Date.now(),
          associations: []
        })))
      }
    }

    // Determine overall success
    const allSucceeded = allTaskResults.every(t => t.success)

    // Aggregate outputs using the configured strategy
    const outputs = allTaskResults
      .filter(t => t.output)
      .map(t => ({
        agentId: orchestratorAgentId,
        role: 'orchestrator' as AgentRole,
        success: t.success || false,
        content: t.output,
        metadata: { error: t.error }
      }))

    const aggregationResult = this.resultAggregator.aggregate(outputs, {
      strategy: this.aggregationStrategy
    })

    orchestratorAgent.status = allSucceeded ? 'completed' : 'failed'
    orchestratorAgent.completedAt = Date.now()

    this.saveDelegation(orchestratorAgentId).catch(err => {
      console.warn(`[SubAgentManager] Failed to save delegation:`, err)
    })

    const result: SubAgentResult = {
      agentId: orchestratorAgentId,
      success: allSucceeded,
      tasks: allTaskResults,
      aggregatedOutput: aggregationResult.finalOutput,
      kvCacheSnapshot: this.getKVCacheSnapshot(orchestratorAgentId)!
    }

    if (this.onAgentComplete) {
      this.onAgentComplete(result)
    }

    return result
  }

  /**
   * Aggregate results from multiple agents using the configured strategy
   */
  aggregateResults(agentIds: string[]): {
    success: boolean
    aggregatedOutput: string
    summary: string
    metadata: Record<string, unknown>
  } {
    const outputs = agentIds
      .map(id => this.agents.get(id))
      .filter((agent): agent is SubAgent => agent !== undefined)
      .flatMap(agent =>
        agent.tasks
          .filter(t => t.result)
          .map(t => ({
            agentId: agent.id,
            role: 'orchestrator' as AgentRole,
            success: t.result!.success,
            content: t.result!.output,
            metadata: { error: t.result!.error }
          }))
      )

    const result = this.resultAggregator.aggregate(outputs, {
      strategy: this.aggregationStrategy
    })

    return {
      success: result.metadata.failedOutputs === 0,
      aggregatedOutput: result.finalOutput,
      summary: result.summary,
      metadata: result.metadata
    }
  }

  /**
   * Distribute tasks to child agents based on role
   */
  distributeTasks(orchestratorAgentId: string, tasks: Array<{
    description: string
    toolCalls: ToolCall[]
    dependencies?: string[]
    assignedRole?: AgentRole
  }>): string[] {
    const orchestratorAgent = this.agents.get(orchestratorAgentId)
    if (!orchestratorAgent) return []

    const childAgents = Array.from(this.agents.values()).filter(
      a => a.parentId === orchestratorAgentId && a.status !== 'cancelled'
    )

    if (childAgents.length === 0) {
      // No child agents, add to orchestrator directly
      const createdTasks = this.addTasks(orchestratorAgentId, tasks)
      return createdTasks.map(t => t.id)
    }

    // Group agents by role
    const agentsByRole = new Map<AgentRole, SubAgent[]>()
    for (const agent of childAgents) {
      const role = (agent as any).role || 'orchestrator'
      const existing = agentsByRole.get(role) || []
      existing.push(agent)
      agentsByRole.set(role, existing)
    }

    const createdTaskIds: string[] = []

    for (const taskSpec of tasks) {
      const role = taskSpec.assignedRole || 'orchestrator'
      const availableAgents = agentsByRole.get(role) || agentsByRole.get('orchestrator') || []

      if (availableAgents.length === 0) {
        // No suitable agent, add to orchestrator
        const createdTasks = this.addTasks(orchestratorAgentId, [taskSpec])
        createdTaskIds.push(...createdTasks.map(t => t.id))
        continue
      }

      // Pick agent with fewest tasks
      const selectedAgent = availableAgents.reduce((min, agent) =>
        agent.tasks.length < min.tasks.length ? agent : min
      )

      const createdTasks = this.addTasks(selectedAgent.id, [taskSpec])
      createdTaskIds.push(...createdTasks.map(t => t.id))
    }

    return createdTaskIds
  }

  /**
   * Get execution plan for an orchestrator
   */
  getExecutionPlan(orchestratorAgentId: string): ExecutionPlan | undefined {
    return this.executionPlans.get(orchestratorAgentId)
  }

  /**
   * Get orchestration metadata
   */
  getOrchestrationMetadata(orchestratorAgentId: string): {
    totalSteps: number
    completedSteps: number
    pendingSteps: number
    parallelGroups: string[][]
  } | null {
    const plan = this.executionPlans.get(orchestratorAgentId)
    const completed = this.completedSteps.get(orchestratorAgentId)

    if (!plan) return null

    return {
      totalSteps: plan.steps.length,
      completedSteps: completed?.size || 0,
      pendingSteps: plan.steps.length - (completed?.size || 0),
      parallelGroups: plan.parallelGroups || []
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
