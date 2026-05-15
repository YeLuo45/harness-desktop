import { v4 as uuidv4 } from 'uuid'
import type { SubAgent, SubTask, SubAgentResult, SubTaskResult, ToolCall, MemoryPointer, AgentRole, AgentCapabilities } from '../types'
import { SubAgentManager } from './subAgentManager'

// Agent role capabilities
export const AgentRoleCapabilities: Record<AgentRole, readonly string[]> = {
  orchestrator: ['plan', 'delegate', 'aggregate'],
  code_reviewer: ['review', 'suggest', 'approve'],
  test_generator: ['generate', 'validate', 'coverage'],
  refactorer: ['extract', 'inline', 'rename', 'move']
}

// Default agent configurations
export const DefaultAgentConfigs: Record<AgentRole, { maxConcurrentTasks: number; timeout: number; retryOnFailure: boolean }> = {
  orchestrator: { maxConcurrentTasks: 4, timeout: 60000, retryOnFailure: true },
  code_reviewer: { maxConcurrentTasks: 2, timeout: 30000, retryOnFailure: true },
  test_generator: { maxConcurrentTasks: 3, timeout: 45000, retryOnFailure: true },
  refactorer: { maxConcurrentTasks: 2, timeout: 45000, retryOnFailure: true }
}

export interface TaskDecompositionResult {
  tasks: Array<{
    id: string
    description: string
    toolCalls: ToolCall[]
    dependencies: string[]
    assignedRole: AgentRole
  }>
  orchestratorPlan: string
}

export interface AggregatedCollaborationResult {
  success: boolean
  totalAgents: number
  successfulAgents: number
  failedAgents: number
  aggregatedOutput: string
  kvCacheSnapshots: Map<string, { pointers: MemoryPointer[]; tokenCount: number; maxTokens: number }>
  taskSummary: {
    total: number
    completed: number
    failed: number
    successRate: number
  }
}

export class MultiAgentEngine {
  private manager: SubAgentManager
  private orchestratorId: string | null = null

  constructor(options?: { maxConcurrentAgents?: number; maxKVCacheSize?: number }) {
    this.manager = new SubAgentManager({
      maxConcurrentAgents: options?.maxConcurrentAgents || 4,
      maxKVCacheSize: options?.maxKVCacheSize || 128000
    })
  }

  /**
   * Create the orchestrator agent
   */
  createOrchestrator(name: string = 'MainOrchestrator'): SubAgent {
    const orchestrator = this.manager.createAgent(name)
    this.orchestratorId = orchestrator.id
    return orchestrator
  }

  /**
   * Create a specialized sub-agent
   */
  createSpecializedAgent(name: string, role: AgentRole, parentId?: string): SubAgent {
    const parent = parentId ?? this.orchestratorId ?? undefined
    return this.manager.createAgent(name, parent)
  }

  /**
   * Decompose a complex task into subtasks for multiple agents
   */
  decomposeTask(
    description: string,
    toolCalls: ToolCall[],
    options?: {
      maxSubtasks?: number
      includeDependencies?: boolean
    }
  ): TaskDecompositionResult {
    const maxSubtasks = options?.maxSubtasks || 5
    const includeDependencies = options?.includeDependencies ?? true

    // Simple task decomposition heuristic
    // In a real implementation, this would use LLM to intelligently decompose
    const tasks: TaskDecompositionResult['tasks'] = []
    const orchestratorPlan: string[] = []

    if (toolCalls.length <= 1) {
      // Single task, no decomposition needed
      tasks.push({
        id: uuidv4(),
        description,
        toolCalls,
        dependencies: [],
        assignedRole: 'orchestrator'
      })
      orchestratorPlan.push(`Execute: ${description}`)
    } else {
      // Group tool calls by complexity/type
      const groupedCalls = this.groupToolCallsByComplexity(toolCalls)

      let depId = ''
      for (const [group, calls] of Object.entries(groupedCalls)) {
        const taskId = uuidv4()
        const role = this.inferRoleFromGroup(group)

        tasks.push({
          id: taskId,
          description: `${group} task`,
          toolCalls: calls,
          dependencies: includeDependencies && depId ? [depId] : [],
          assignedRole: role
        })

        orchestratorPlan.push(`[${role}] ${group}: ${calls.length} operation(s)`)
        depId = taskId
      }
    }

    return { tasks, orchestratorPlan: orchestratorPlan.join('\n') }
  }

  /**
   * Group tool calls by complexity/type
   */
  private groupToolCallsByComplexity(toolCalls: ToolCall[]): Record<string, ToolCall[]> {
    const groups: Record<string, ToolCall[]> = {
      'file_operations': [],
      'bash_commands': [],
      'search_operations': [],
      'other': []
    }

    for (const tc of toolCalls) {
      if (tc.name.startsWith('file_')) {
        groups['file_operations'].push(tc)
      } else if (tc.name.startsWith('bash_') || tc.name === 'bash') {
        groups['bash_commands'].push(tc)
      } else if (tc.name.includes('search') || tc.name.includes('grep') || tc.name.includes('glob')) {
        groups['search_operations'].push(tc)
      } else {
        groups['other'].push(tc)
      }
    }

    // Remove empty groups
    return Object.fromEntries(
      Object.entries(groups).filter(([_, calls]) => calls.length > 0)
    )
  }

  /**
   * Infer agent role from tool call group
   */
  private inferRoleFromGroup(group: string): AgentRole {
    switch (group) {
      case 'file_operations':
        return 'refactorer'
      case 'bash_commands':
        return 'test_generator'
      case 'search_operations':
        return 'code_reviewer'
      default:
        return 'orchestrator'
    }
  }

  /**
   * Add tasks to an agent
   */
  addTasks(agentId: string, tasks: Array<{ description: string; toolCalls: ToolCall[]; dependencies?: string[] }>): SubTask[] {
    return this.manager.addTasks(agentId, tasks)
  }

  /**
   * Set tool executor for the manager
   */
  setToolExecutor(executor: (toolName: string, args: Record<string, unknown>) => Promise<any>): void {
    this.manager.setToolExecutor(executor)
  }

  /**
   * Execute a single agent
   */
  async runAgent(agentId: string): Promise<SubAgentResult> {
    return this.manager.runAgent(agentId)
  }

  /**
   * Run all agents in collaboration
   */
  async runCollaboration(agentIds: string[]): Promise<AggregatedCollaborationResult> {
    const results: SubAgentResult[] = []
    let successfulAgents = 0
    let failedAgents = 0

    for (const agentId of agentIds) {
      try {
        const result = await this.manager.runAgent(agentId)
        results.push(result)
        if (result.success) {
          successfulAgents++
        } else {
          failedAgents++
        }
      } catch (error) {
        failedAgents++
      }
    }

    // Aggregate outputs
    const aggregatedOutput = results
      .filter(r => r.aggregatedOutput)
      .map(r => `[${r.agentId}]: ${r.aggregatedOutput}`)
      .join('\n\n')

    // Collect KV cache snapshots
    const kvCacheSnapshots = new Map<string, { pointers: MemoryPointer[]; tokenCount: number; maxTokens: number }>()
    for (const result of results) {
      if (result.kvCacheSnapshot) {
        kvCacheSnapshots.set(result.agentId, result.kvCacheSnapshot)
      }
    }

    // Calculate task summary
    let totalTasks = 0
    let completedTasks = 0
    let failedTasks = 0

    for (const result of results) {
      for (const task of result.tasks) {
        totalTasks++
        if (task.success) {
          completedTasks++
        } else {
          failedTasks++
        }
      }
    }

    return {
      success: failedAgents === 0,
      totalAgents: agentIds.length,
      successfulAgents,
      failedAgents,
      aggregatedOutput,
      kvCacheSnapshots,
      taskSummary: {
        total: totalTasks,
        completed: completedTasks,
        failed: failedTasks,
        successRate: totalTasks > 0 ? completedTasks / totalTasks : 0
      }
    }
  }

  /**
   * Get all agents
   */
  getAllAgents(): SubAgent[] {
    return this.manager.getAllAgents()
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): SubAgent | undefined {
    return this.manager.getAgent(agentId)
  }

  /**
   * Get manager statistics
   */
  getStats() {
    return this.manager.getStats()
  }

  /**
   * Cancel an agent
   */
  cancelAgent(agentId: string): boolean {
    return this.manager.cancelAgent(agentId)
  }

  /**
   * Get KV cache snapshot
   */
  getKVCacheSnapshot(agentId: string) {
    return this.manager.getKVCacheSnapshot(agentId)
  }

  /**
   * Clear completed agents
   */
  clearCompletedAgents(): number {
    return this.manager.clearCompletedAgents()
  }
}

// Singleton instance
let multiAgentEngineInstance: MultiAgentEngine | null = null

export function getMultiAgentEngine(): MultiAgentEngine | null {
  return multiAgentEngineInstance
}

export function initMultiAgentEngine(options?: { maxConcurrentAgents?: number; maxKVCacheSize?: number }): MultiAgentEngine {
  multiAgentEngineInstance = new MultiAgentEngine(options)
  return multiAgentEngineInstance
}
