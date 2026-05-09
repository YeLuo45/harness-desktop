/**
 * P11: Multi-Agent Collaboration - Orchestrator
 * 
 * Intelligent orchestration of multi-agent parallel/serial execution.
 */

import { v4 as uuidv4 } from 'uuid'
import type { CollaborationSession, CollaborationTask, AgentInstance } from './types'

export interface ExecutionStep {
  stepId: string
  agentId: string
  taskId: string
  parallelWith?: string[]  // Step IDs that can run in parallel
  waitFor?: string[]       // Step IDs that must complete first
  estimatedDuration?: number
  priority?: 'low' | 'medium' | 'high'
}

export interface ExecutionPlan {
  sessionId: string
  steps: ExecutionStep[]
  totalDuration?: number
  parallelGroups?: string[][]  // Groups of steps that can execute in parallel
  createdAt: number
}

export interface PlanMetadata {
  totalSteps: number
  estimatedDuration: number
  parallelExecutions: number
  sequentialSteps: number
}

const AGENT_CONCURRENCY: Record<string, number> = {
  orchestrator: 1,
  code_reviewer: 3,
  test_generator: 2,
  refactorer: 2
}

export class Orchestrator {
  /**
   * Create an execution plan from a collaboration session
   */
  createExecutionPlan(session: CollaborationSession): ExecutionPlan {
    const tasks = session.tasks
    const agents = Array.from(session.agents.values())
    
    if (tasks.length === 0) {
      return {
        sessionId: session.id,
        steps: [],
        createdAt: Date.now()
      }
    }

    // Build dependency graph
    const taskDependencies = new Map<string, Set<string>>()
    const taskDependents = new Map<string, Set<string>>()
    
    for (const task of tasks) {
      taskDependencies.set(task.id, new Set(task.dependencies))
      taskDependents.set(task.id, new Set())
    }

    // Build reverse dependencies (who depends on this task)
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        const dependents = taskDependents.get(depId)
        if (dependents) {
          dependents.add(task.id)
        }
      }
    }

    // Assign agents to tasks based on role and availability
    const taskAgentMap = this.assignAgentsToTasks(tasks, agents)
    
    // Generate execution steps
    const steps: ExecutionStep[] = []
    const inDegree = new Map<string, number>()
    
    for (const task of tasks) {
      inDegree.set(task.id, task.dependencies.length)
    }

    // Topological sort to determine execution order
    const executionOrder = this.topologicalSort(tasks, taskDependencies)
    
    // Create steps based on execution order
    for (const taskId of executionOrder) {
      const task = tasks.find(t => t.id === taskId)
      if (!task) continue

      const agentId = taskAgentMap.get(taskId) || 'orchestrator'
      
      // Find steps this can run in parallel with
      const parallelWith = this.findParallelSteps(taskId, tasks, taskDependencies, inDegree)
      
      // Find steps this must wait for
      const waitFor = Array.from(task.dependencies)

      steps.push({
        stepId: uuidv4(),
        agentId,
        taskId,
        parallelWith: parallelWith.length > 0 ? parallelWith : undefined,
        waitFor: waitFor.length > 0 ? waitFor : undefined,
        estimatedDuration: this.estimateStepDuration(task),
        priority: this.determinePriority(task)
      })
    }

    // Compute parallel groups
    const parallelGroups = this.computeParallelGroups(steps)

    // Calculate total estimated duration
    const totalDuration = this.calculateTotalDuration(steps, parallelGroups)

    return {
      sessionId: session.id,
      steps,
      totalDuration,
      parallelGroups,
      createdAt: Date.now()
    }
  }

  /**
   * Determine if two steps can run in parallel
   */
  canRunParallel(stepA: ExecutionStep, stepB: ExecutionStep): boolean {
    // Cannot run parallel if one waits for the other
    if (stepA.waitFor?.includes(stepB.stepId) || stepB.waitFor?.includes(stepA.stepId)) {
      return false
    }

    // Cannot run parallel if they have conflicting dependencies
    if (stepA.waitFor && stepB.waitFor) {
      for (const depA of stepA.waitFor) {
        if (stepB.waitFor.includes(depA)) {
          return false
        }
      }
    }

    // Check agent concurrency limits
    // (simplified - would need agent registry for full implementation)

    return true
  }

  /**
   * Get next executable steps from a plan given completed step IDs
   */
  getNextExecutableSteps(plan: ExecutionPlan, completed: Set<string>): ExecutionStep[] {
    const { steps } = plan
    
    // Find steps whose dependencies are all satisfied
    const executable: ExecutionStep[] = []
    
    for (const step of steps) {
      if (completed.has(step.stepId)) continue
      
      // Check if all waitFor steps are completed
      const waitForCompleted = !step.waitFor || step.waitFor.every(dep => completed.has(dep))
      
      if (waitForCompleted) {
        executable.push(step)
      }
    }

    // Filter for parallel execution compatibility
    const result: ExecutionStep[] = []
    const added = new Set<string>()
    
    for (const step of executable) {
      if (added.has(step.stepId)) continue
      
      result.push(step)
      added.add(step.stepId)
      
      // Add steps that can run in parallel with this one
      if (step.parallelWith) {
        for (const parallelId of step.parallelWith) {
          const parallelStep = steps.find(s => s.stepId === parallelId)
          if (parallelStep && !added.has(parallelId) && executable.includes(parallelStep)) {
            result.push(parallelStep)
            added.add(parallelId)
          }
        }
      }
    }

    return result
  }

  /**
   * Assign agents to tasks based on role and load
   */
  private assignAgentsToTasks(
    tasks: CollaborationTask[],
    agents: AgentInstance[]
  ): Map<string, string> {
    const taskAgentMap = new Map<string, string>()
    
    // Group agents by role
    const agentsByRole = new Map<string, AgentInstance[]>()
    for (const agent of agents) {
      const roleAgents = agentsByRole.get(agent.config.role) || []
      roleAgents.push(agent)
      agentsByRole.set(agent.config.role, roleAgents)
    }

    // Track active tasks per agent
    const agentTaskCount = new Map<string, number>()
    for (const agent of agents) {
      agentTaskCount.set(agent.id, 0)
    }

    // Assign tasks based on role matching and load
    for (const task of tasks) {
      if (task.assignedAgent) {
        // Already assigned
        taskAgentMap.set(task.id, task.assignedAgent)
        continue
      }

      // Find best available agent for this task
      const taskRole = this.inferTaskRole(task)
      const roleAgents = agentsByRole.get(taskRole) || []
      
      // Find agent with lowest current load
      let bestAgent: AgentInstance | null = null
      let lowestLoad = Infinity
      
      for (const agent of roleAgents) {
        const currentLoad = agentTaskCount.get(agent.id) || 0
        const maxConcurrent = AGENT_CONCURRENCY[agent.config.role] || 1
        
        if (currentLoad < maxConcurrent && currentLoad < lowestLoad) {
          lowestLoad = currentLoad
          bestAgent = agent
        }
      }

      if (bestAgent) {
        taskAgentMap.set(task.id, bestAgent.id)
        agentTaskCount.set(bestAgent.id, lowestLoad + 1)
      } else {
        // Fallback to orchestrator
        taskAgentMap.set(task.id, 'orchestrator')
      }
    }

    return taskAgentMap
  }

  /**
   * Infer the appropriate role for a task based on its description
   */
  private inferTaskRole(task: CollaborationTask): string {
    const desc = task.description.toLowerCase()
    
    if (desc.includes('review') || desc.includes('analyze') || desc.includes('check')) {
      return 'code_reviewer'
    }
    if (desc.includes('test') || desc.includes('generate') || desc.includes('spec')) {
      return 'test_generator'
    }
    if (desc.includes('refactor') || desc.includes('restructure') || desc.includes('optimize')) {
      return 'refactorer'
    }
    
    return 'orchestrator'
  }

  /**
   * Perform topological sort on tasks
   */
  private topologicalSort(
    tasks: CollaborationTask[],
    dependencies: Map<string, Set<string>>
  ): string[] {
    const result: string[] = []
    const visited = new Set<string>()
    const temp = new Set<string>()

    const visit = (taskId: string) => {
      if (temp.has(taskId)) {
        throw new Error(`Circular dependency detected involving task ${taskId}`)
      }
      if (visited.has(taskId)) return

      temp.add(taskId)
      
      const deps = dependencies.get(taskId)
      if (deps) {
        for (const depId of deps) {
          visit(depId)
        }
      }

      temp.delete(taskId)
      visited.add(taskId)
      result.push(taskId)
    }

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        visit(task.id)
      }
    }

    return result
  }

  /**
   * Find steps that can run in parallel with a given step
   */
  private findParallelSteps(
    stepId: string,
    tasks: CollaborationTask[],
    dependencies: Map<string, Set<string>>,
    inDegree: Map<string, number>
  ): string[] {
    const parallelWith: string[] = []
    const currentTask = tasks.find(t => t.id === stepId)
    if (!currentTask) return parallelWith

    for (const task of tasks) {
      if (task.id === stepId) continue
      
      // Check if task has same or zero dependencies
      const currentDeps = dependencies.get(stepId) || new Set()
      const taskDeps = dependencies.get(task.id) || new Set()
      
      // Can be parallel if they share no dependencies
      let hasConflict = false
      for (const dep of currentDeps) {
        if (taskDeps.has(dep)) {
          hasConflict = true
          break
        }
      }
      
      if (!hasConflict && taskDeps.size === 0) {
        parallelWith.push(task.id)
      }
    }

    return parallelWith
  }

  /**
   * Compute parallel execution groups
   */
  private computeParallelGroups(steps: ExecutionStep[]): string[][] {
    const groups: string[][] = []
    const assigned = new Set<string>()

    // Find steps with no dependencies
    const noDeps = steps.filter(s => !s.waitFor || s.waitFor.length === 0)
    if (noDeps.length > 0) {
      groups.push(noDeps.map(s => s.stepId))
      noDeps.forEach(s => assigned.add(s.stepId))
    }

    // Process remaining steps in dependency order
    while (assigned.size < steps.length) {
      const ready: ExecutionStep[] = []
      
      for (const step of steps) {
        if (assigned.has(step.stepId)) continue
        
        const allDepsDone = !step.waitFor || step.waitFor.every(dep => assigned.has(dep))
        if (allDepsDone) {
          ready.push(step)
        }
      }

      if (ready.length === 0 && assigned.size < steps.length) {
        // Circular dependency or error
        break
      }

      // Group ready steps by whether they're parallel
      const parallelReady = ready.filter(s => s.parallelWith && s.parallelWith.length > 0)
      const sequentialReady = ready.filter(s => !s.parallelWith || s.parallelWith.length === 0)

      if (parallelReady.length > 0) {
        const parallelGroup = parallelReady.map(s => s.stepId)
        groups.push(parallelGroup)
        parallelGroup.forEach(id => assigned.add(id))
      }

      for (const step of sequentialReady) {
        groups.push([step.stepId])
        assigned.add(step.stepId)
      }
    }

    return groups
  }

  /**
   * Calculate total estimated duration
   */
  private calculateTotalDuration(steps: ExecutionStep[], parallelGroups: string[][]): number {
    let totalDuration = 0

    for (const group of parallelGroups) {
      // Parallel steps in a group take as long as the longest one
      let groupDuration = 0
      for (const stepId of group) {
        const step = steps.find(s => s.stepId === stepId)
        if (step && step.estimatedDuration) {
          groupDuration = Math.max(groupDuration, step.estimatedDuration)
        }
      }
      totalDuration += groupDuration
    }

    return totalDuration
  }

  /**
   * Estimate step duration based on task complexity
   */
  private estimateStepDuration(task: CollaborationTask): number {
    const desc = task.description.toLowerCase()
    let baseDuration = 60000 // 1 minute base

    if (desc.includes('architecture') || desc.includes('system')) {
      baseDuration = 180000 // 3 minutes
    } else if (desc.includes('review') || desc.includes('analyze')) {
      baseDuration = 90000 // 1.5 minutes
    } else if (desc.includes('test')) {
      baseDuration = 120000 // 2 minutes
    }

    return baseDuration
  }

  /**
   * Determine task priority
   */
  private determinePriority(task: CollaborationTask): 'low' | 'medium' | 'high' {
    const desc = task.description.toLowerCase()
    
    if (desc.includes('critical') || desc.includes('essential') || desc.includes('must')) {
      return 'high'
    }
    if (desc.includes('optional') || desc.includes('nice') || desc.includes('enhance')) {
      return 'low'
    }
    return 'medium'
  }

  /**
   * Get plan metadata
   */
  getPlanMetadata(plan: ExecutionPlan): PlanMetadata {
    const parallelGroups = plan.parallelGroups || []
    const parallelExecutions = parallelGroups.filter(g => g.length > 1).length
    const sequentialSteps = plan.steps.filter(s => !s.parallelWith || s.parallelWith.length === 0).length

    return {
      totalSteps: plan.steps.length,
      estimatedDuration: plan.totalDuration || 0,
      parallelExecutions,
      sequentialSteps
    }
  }
}

export const orchestrator = new Orchestrator()
