/**
 * P11: Multi-Agent Collaboration - CollaborationManager
 * 
 * Core manager for multi-agent task orchestration and collaboration.
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  AgentInstance,
  AgentOutput,
  CollaborationSession,
  CollaborationTask,
  OrchestrationPlan,
  AggregationResult,
  CollaborationEvent,
  CollaborationEventHandler,
  AgentConfig,
  AgentRole,
  BUILT_IN_AGENTS
} from './types'
import { BUILT_IN_AGENTS, CollaborationStatus } from './types'
import { TaskDecomposer, taskDecomposer, type DecomposedTask } from './taskDecomposer'
import { Orchestrator, orchestrator, type ExecutionPlan, type ExecutionStep } from './orchestrator'
import { ResultAggregator, resultAggregator, type AggregationConfig } from './resultAggregator'

const STORAGE_KEY = 'harness_collaboration_sessions'

export class CollaborationManager {
  private sessions: Map<string, CollaborationSession> = new Map()
  private currentSession: CollaborationSession | null = null
  private eventHandlers: Set<CollaborationEventHandler> = new Set()
  private agentRegistry: Map<string, AgentConfig> = new Map()
  private initialized: boolean = false
  private taskDecomposer: TaskDecomposer
  private orchestrator: Orchestrator
  private aggregator: ResultAggregator
  private aggregationStrategy: AggregationConfig['strategy'] = 'sequential'

  constructor() {
    this.registerBuiltInAgents()
    this.taskDecomposer = new TaskDecomposer()
    this.orchestrator = new Orchestrator()
    this.aggregator = new ResultAggregator()
  }

  /**
   * Initialize and load sessions from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Load sessions from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const sessionsData = JSON.parse(stored) as Array<Omit<CollaborationSession, 'agents' | 'tasks' | 'results'> & { agents: [string, AgentInstance][]; tasks: CollaborationTask[]; results: [string, AgentOutput][] }>
        
        for (const sessionData of sessionsData) {
          const session: CollaborationSession = {
            ...sessionData,
            agents: new Map(sessionData.agents),
            results: new Map(sessionData.results)
          }
          this.sessions.set(session.id, session)
        }
      }
    } catch (error) {
      console.error('Failed to load collaboration sessions:', error)
    }

    this.initialized = true
  }

  /**
   * Register built-in agents
   */
  private registerBuiltInAgents(): void {
    for (const agent of BUILT_IN_AGENTS) {
      this.agentRegistry.set(agent.id, agent)
    }
  }

  /**
   * Create a new collaboration session
   */
  async createSession(name: string, description?: string): Promise<CollaborationSession> {
    const session: CollaborationSession = {
      id: uuidv4(),
      name,
      description,
      status: 'idle',
      agents: new Map(),
      tasks: [],
      results: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.sessions.set(session.id, session)
    this.currentSession = session
    await this.persistSessions()

    this.emitEvent({ type: 'session_started', sessionId: session.id, timestamp: Date.now() })

    return session
  }

  /**
   * Register an agent to a session
   */
  registerAgent(sessionId: string, config: AgentConfig): AgentInstance {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const instance: AgentInstance = {
      id: config.id,
      config,
      status: 'idle'
    }

    session.agents.set(config.id, instance)
    session.updatedAt = Date.now()
    this.persistSessions()

    this.emitEvent({ type: 'agent_registered', sessionId, agentId: config.id, timestamp: Date.now() })

    return instance
  }

  /**
   * Add a task to a session
   */
  addTask(sessionId: string, description: string, dependencies: string[] = []): CollaborationTask {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const task: CollaborationTask = {
      id: uuidv4(),
      description,
      status: 'pending',
      dependencies,
      createdAt: Date.now()
    }

    session.tasks.push(task)
    session.updatedAt = Date.now()
    this.persistSessions()

    return task
  }

  /**
   * Assign a task to an agent
   */
  assignTask(sessionId: string, taskId: string, agentId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    const task = session.tasks.find(t => t.id === taskId)
    const agent = session.agents.get(agentId)
    if (!task || !agent) return false

    task.assignedAgent = agentId
    task.status = 'assigned'
    session.updatedAt = Date.now()
    this.persistSessions()

    this.emitEvent({ type: 'task_assigned', sessionId, agentId, taskId, timestamp: Date.now() })

    return true
  }

  /**
   * Start executing tasks in a session
   */
  async executeSession(sessionId: string): Promise<CollaborationSession> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    session.status = 'working'
    this.emitEvent({ type: 'session_started', sessionId, timestamp: Date.now() })

    try {
      // Create orchestration plan
      const plan = this.createPlan(session)
      
      // Execute tasks according to plan
      for (const taskGroup of plan.executionOrder) {
        await Promise.all(
          taskGroup.map(taskId => this.executeTask(session, taskId))
        )
      }

      session.status = 'completed'
      session.completedAt = Date.now()
    } catch (error) {
      session.status = 'failed'
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emitEvent({ type: 'session_failed', sessionId, data: { error: errorMessage }, timestamp: Date.now() })
    }

    session.updatedAt = Date.now()
    await this.persistSessions()

    return session
  }

  /**
   * Execute a single task
   */
  private async executeTask(session: CollaborationSession, taskId: string): Promise<void> {
    const task = session.tasks.find(t => t.id === taskId)
    if (!task) return

    // Check dependencies
    for (const depId of task.dependencies) {
      const depTask = session.tasks.find(t => t.id === depId)
      if (depTask && depTask.status !== 'completed') {
        task.status = 'failed'
        return
      }
    }

    task.status = 'in_progress'
    task.startedAt = Date.now()

    const agent = task.assignedAgent ? session.agents.get(task.assignedAgent) : null
    if (agent) {
      agent.status = 'working'
      agent.currentTask = taskId
    }

    try {
      // Simulate task execution (in real implementation, this would invoke LLM)
      const result: AgentOutput = {
        agentId: agent?.id || 'system',
        role: agent?.config.role || 'orchestrator',
        success: true,
        content: `Executed: ${task.description}`,
        metadata: { taskId, executedAt: Date.now() }
      }

      task.result = result
      task.status = 'completed'
      task.completedAt = Date.now()

      if (agent) {
        agent.status = 'completed'
        agent.result = result
        agent.endTime = Date.now()
      }

      session.results.set(taskId, result)
      this.emitEvent({ type: 'task_completed', sessionId: session.id, agentId: agent?.id, taskId, timestamp: Date.now() })
    } catch (error) {
      task.status = 'failed'
      if (agent) {
        agent.status = 'failed'
        agent.error = error instanceof Error ? error.message : String(error)
      }
    }

    session.updatedAt = Date.now()
  }

  /**
   * Create an orchestration plan
   */
  private createPlan(session: CollaborationSession): OrchestrationPlan {
    const tasks = session.tasks
    const taskMap = new Map(tasks.map(t => [t.id, t]))
    
    // Build dependency graph
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()

    for (const task of tasks) {
      inDegree.set(task.id, task.dependencies.length)
      adjacency.set(task.id, [])
    }

    for (const task of tasks) {
      for (const depId of task.dependencies) {
        const deps = adjacency.get(depId)
        if (deps) {
          deps.push(task.id)
        }
      }
    }

    // Topological sort with level grouping
    const executionOrder: string[][] = []
    const visited = new Set<string>()

    while (visited.size < tasks.length) {
      // Find tasks with no remaining dependencies
      const level: string[] = []
      for (const [taskId, degree] of inDegree) {
        if (degree === 0 && !visited.has(taskId)) {
          level.push(taskId)
        }
      }

      if (level.length === 0 && visited.size < tasks.length) {
        // Circular dependency detected
        throw new Error('Circular dependency detected in tasks')
      }

      executionOrder.push(level)

      // Mark these as visited and reduce dependencies of dependent tasks
      for (const taskId of level) {
        visited.add(taskId)
        for (const dependentId of adjacency.get(taskId) || []) {
          const newDegree = (inDegree.get(dependentId) || 1) - 1
          inDegree.set(dependentId, newDegree)
        }
      }
    }

    return {
      sessionId: session.id,
      tasks: session.tasks,
      executionOrder,
      createdAt: Date.now()
    }
  }

  /**
   * Aggregate results from all agents
   */
  aggregateResults(sessionId: string): AggregationResult {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const outputs = Array.from(session.results.values())

    const finalOutput = outputs.map(o => o.content).join('\n\n')
    
    const summary = `Completed ${outputs.filter(o => o.success).length}/${outputs.length} tasks successfully`

    return {
      sessionId,
      outputs,
      finalOutput,
      summary,
      metadata: {
        totalTasks: session.tasks.length,
        completedTasks: session.tasks.filter(t => t.status === 'completed').length,
        failedTasks: session.tasks.filter(t => t.status === 'failed').length,
        totalAgents: session.agents.size,
        duration: session.completedAt ? session.completedAt - session.createdAt : undefined
      }
    }
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * List all sessions
   */
  listSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Get current session
   */
  getCurrentSession(): CollaborationSession | null {
    return this.currentSession
  }

  /**
   * Subscribe to collaboration events
   */
  onEvent(handler: CollaborationEventHandler): () => void {
    this.eventHandlers.add(handler)
    return () => this.eventHandlers.delete(handler)
  }

  /**
   * Emit an event to all handlers
   */
  private emitEvent(event: CollaborationEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event)
      } catch (error) {
        console.error('Error in collaboration event handler:', error)
      }
    }
  }

  /**
   * Get all registered agent configs
   */
  getRegisteredAgents(): AgentConfig[] {
    return Array.from(this.agentRegistry.values())
  }

  /**
   * Get agents by role
   */
  getAgentsByRole(role: AgentRole): AgentConfig[] {
    return Array.from(this.agentRegistry.values()).filter(a => a.role === role)
  }

  // ========== Task Decomposition & Orchestration Methods ==========

  /**
   * Decompose a complex task and create an orchestration plan
   */
  async decomposeAndPlan(task: string): Promise<OrchestrationPlan> {
    // Decompose the task
    const decomposed = this.taskDecomposer.decompose(task)
    
    // Create or use current session
    let session = this.currentSession
    if (!session) {
      session = await this.createSession('Decomposed Task Session', `Auto-generated for: ${task.substring(0, 50)}...`)
    }

    // Convert subtasks to collaboration tasks
    const collaborationTasks: CollaborationTask[] = decomposed.subtasks.map(subtask => ({
      id: subtask.id,
      description: subtask.description,
      status: 'pending' as const,
      dependencies: subtask.dependencies,
      createdAt: Date.now()
    }))

    // Create execution plan
    const executionPlan = this.orchestrator.createExecutionPlan({
      ...session,
      tasks: collaborationTasks
    })

    // Build OrchestrationPlan from ExecutionPlan
    return {
      sessionId: session.id,
      tasks: collaborationTasks,
      executionOrder: executionPlan.parallelGroups || [],
      estimatedDuration: decomposed.estimatedDuration,
      createdAt: Date.now()
    }
  }

  /**
   * Execute a session with intelligent orchestration
   */
  async executeWithOrchestration(plan: ExecutionPlan): Promise<AggregationResult> {
    const session = this.sessions.get(plan.sessionId)
    if (!session) {
      throw new Error(`Session not found: ${plan.sessionId}`)
    }

    session.status = 'working'
    this.emitEvent({ type: 'session_started', sessionId: session.id, timestamp: Date.now() })

    const completed = new Set<string>()

    try {
      // Execute steps according to plan
      for (const step of plan.steps) {
        // Wait for dependencies
        if (step.waitFor) {
          for (const depId of step.waitFor) {
            while (!completed.has(depId)) {
              // In real implementation, this would wait for the step to complete
              // For now, we simulate completion
              await new Promise(resolve => setTimeout(resolve, 10))
            }
          }
        }

        // Execute step
        await this.executeStep(session, step)
        completed.add(step.stepId)
      }

      session.status = 'completed'
      session.completedAt = Date.now()
    } catch (error) {
      session.status = 'failed'
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.emitEvent({ type: 'session_failed', sessionId: session.id, data: { error: errorMessage }, timestamp: Date.now() })
    }

    session.updatedAt = Date.now()
    await this.persistSessions()

    // Aggregate results
    return this.aggregateResults(session.id)
  }

  /**
   * Execute a single step
   */
  private async executeStep(session: CollaborationSession, step: ExecutionStep): Promise<void> {
    const task = session.tasks.find(t => t.id === step.taskId)
    if (!task) return

    task.status = 'in_progress'
    task.startedAt = Date.now()

    const agent = session.agents.get(step.agentId)
    if (agent) {
      agent.status = 'working'
      agent.currentTask = step.taskId
    }

    try {
      // Simulate task execution
      const result: AgentOutput = {
        agentId: step.agentId,
        role: agent?.config.role || 'orchestrator',
        success: true,
        content: `Executed: ${task.description}`,
        metadata: { stepId: step.stepId, taskId: step.taskId, executedAt: Date.now() }
      }

      task.result = result
      task.status = 'completed'
      task.completedAt = Date.now()

      if (agent) {
        agent.status = 'completed'
        agent.result = result
        agent.endTime = Date.now()
      }

      session.results.set(step.taskId, result)
      this.emitEvent({ type: 'task_completed', sessionId: session.id, agentId: step.agentId, taskId: step.taskId, timestamp: Date.now() })
    } catch (error) {
      task.status = 'failed'
      if (agent) {
        agent.status = 'failed'
        agent.error = error instanceof Error ? error.message : String(error)
      }
    }

    session.updatedAt = Date.now()
  }

  /**
   * Set aggregation strategy
   */
  setAggregationStrategy(strategy: AggregationConfig['strategy']): void {
    this.aggregationStrategy = strategy
  }

  /**
   * Get current aggregation strategy
   */
  getAggregationStrategy(): AggregationConfig['strategy'] {
    return this.aggregationStrategy
  }

  /**
   * Get task decomposer instance
   */
  getTaskDecomposer(): TaskDecomposer {
    return this.taskDecomposer
  }

  /**
   * Get orchestrator instance
   */
  getOrchestrator(): Orchestrator {
    return this.orchestrator
  }

  /**
   * Get result aggregator instance
   */
  getResultAggregator(): ResultAggregator {
    return this.aggregator
  }

  // ========== Private Methods ==========

  /**
   * Persist sessions to localStorage
   */
  private async persistSessions(): Promise<void> {
    try {
      const sessionsData = Array.from(this.sessions.values()).map(session => ({
        ...session,
        agents: Array.from(session.agents.entries()),
        results: Array.from(session.results.entries())
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionsData))
    } catch (error) {
      console.error('Failed to persist collaboration sessions:', error)
    }
  }
}

// Export singleton
export const collaborationManager = new CollaborationManager()