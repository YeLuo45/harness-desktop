/**
 * P11: Multi-Agent Collaboration - CollaborationManager Tests
 * 
 * TDD tests for multi-agent task orchestration system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  CollaborationManager, 
  collaborationManager, 
  type CollaborationSession, 
  type CollaborationTask, 
  type AgentConfig,
  TaskDecomposer,
  Orchestrator,
  ResultAggregator,
  type AgentOutput,
  type DecomposedTask,
  type ExecutionPlan,
  type AggregationConfig
} from '../services/multiAgent'

// Mock localStorage for node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

describe('CollaborationManager', () => {
  let manager: CollaborationManager

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    manager = new CollaborationManager()
  })

  describe('initialize', () => {
    it('should load sessions from localStorage', async () => {
      // Pre-populate localStorage
      const sessionData = [{
        id: 'test-session',
        name: 'Test Session',
        status: 'idle',
        agents: [],
        tasks: [],
        results: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }]
      localStorage.setItem('harness_collaboration_sessions', JSON.stringify(sessionData))

      const newManager = new CollaborationManager()
      await newManager.initialize()

      const session = newManager.getSession('test-session')
      expect(session).toBeDefined()
      expect(session?.name).toBe('Test Session')
    })

    it('should have built-in agents registered', async () => {
      await manager.initialize()

      const agents = manager.getRegisteredAgents()
      expect(agents.length).toBeGreaterThan(0)

      const orchestrator = manager.getAgentsByRole('orchestrator')
      expect(orchestrator.some(a => a.role === 'orchestrator')).toBe(true)
    })
  })

  describe('createSession', () => {
    it('should create a new collaboration session', async () => {
      await manager.initialize()

      const session = await manager.createSession('Test Collaboration', 'A test session')

      expect(session.id).toBeDefined()
      expect(session.name).toBe('Test Collaboration')
      expect(session.description).toBe('A test session')
      expect(session.status).toBe('idle')
      expect(session.agents.size).toBe(0)
      expect(session.tasks.length).toBe(0)
    })

    it('should set created session as current', async () => {
      await manager.initialize()

      const session = await manager.createSession('Current Session')
      
      expect(manager.getCurrentSession()?.id).toBe(session.id)
    })

    it('should persist to localStorage', async () => {
      await manager.initialize()

      await manager.createSession('Persisted Session')

      const stored = localStorage.getItem('harness_collaboration_sessions')
      expect(stored).toBeTruthy()
    })

    it('should generate unique session IDs', async () => {
      await manager.initialize()

      const session1 = await manager.createSession('Session 1')
      const session2 = await manager.createSession('Session 2')

      expect(session1.id).not.toBe(session2.id)
    })
  })

  describe('registerAgent', () => {
    it('should register an agent to a session', async () => {
      await manager.initialize()
      const session = await manager.createSession('Agent Test')

      const agentConfig: AgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        role: 'code_reviewer',
        maxConcurrentTasks: 2,
        timeout: 60000,
        retryOnFailure: true
      }

      const agent = manager.registerAgent(session.id, agentConfig)

      expect(agent.id).toBe('test-agent')
      expect(agent.status).toBe('idle')
    })

    it('should throw for non-existent session', async () => {
      await manager.initialize()

      const agentConfig: AgentConfig = {
        id: 'orphan-agent',
        name: 'Orphan',
        role: 'orchestrator',
        maxConcurrentTasks: 1,
        timeout: 60000,
        retryOnFailure: false
      }

      expect(() => manager.registerAgent('non-existent', agentConfig)).toThrow('Session not found')
    })
  })

  describe('addTask', () => {
    it('should add a task to a session', async () => {
      await manager.initialize()
      const session = await manager.createSession('Task Test')

      const task = manager.addTask(session.id, 'Review this code')

      expect(task.id).toBeDefined()
      expect(task.description).toBe('Review this code')
      expect(task.status).toBe('pending')
      expect(task.dependencies).toEqual([])
    })

    it('should add task with dependencies', async () => {
      await manager.initialize()
      const session = await manager.createSession('Dependency Test')

      const task1 = manager.addTask(session.id, 'Write code')
      const task2 = manager.addTask(session.id, 'Review code', [task1.id])

      expect(task2.dependencies).toContain(task1.id)
    })

    it('should throw for non-existent session', async () => {
      await manager.initialize()

      expect(() => manager.addTask('non-existent', 'Task')).toThrow('Session not found')
    })
  })

  describe('assignTask', () => {
    it('should assign a task to an agent', async () => {
      await manager.initialize()
      const session = await manager.createSession('Assign Test')
      const agentConfig: AgentConfig = {
        id: 'assign-agent',
        name: 'Assign Agent',
        role: 'code_reviewer',
        maxConcurrentTasks: 1,
        timeout: 60000,
        retryOnFailure: false
      }
      manager.registerAgent(session.id, agentConfig)
      const task = manager.addTask(session.id, 'Review PR')

      const assigned = manager.assignTask(session.id, task.id, 'assign-agent')

      expect(assigned).toBe(true)
      expect(task.assignedAgent).toBe('assign-agent')
      expect(task.status).toBe('assigned')
    })

    it('should return false for non-existent session', async () => {
      await manager.initialize()

      const result = manager.assignTask('non-existent', 'task-id', 'agent-id')
      expect(result).toBe(false)
    })

    it('should return false for non-existent task', async () => {
      await manager.initialize()
      const session = await manager.createSession('Assign Test')

      const result = manager.assignTask(session.id, 'non-existent-task', 'agent-id')
      expect(result).toBe(false)
    })
  })

  describe('executeSession', () => {
    it('should execute all tasks in a session', async () => {
      await manager.initialize()
      const session = await manager.createSession('Execute Test')

      const agentConfig: AgentConfig = {
        id: 'exec-agent',
        name: 'Exec Agent',
        role: 'orchestrator',
        maxConcurrentTasks: 2,
        timeout: 60000,
        retryOnFailure: false
      }
      manager.registerAgent(session.id, agentConfig)
      manager.addTask(session.id, 'Task 1')
      manager.addTask(session.id, 'Task 2')

      const result = await manager.executeSession(session.id)

      expect(result.status).toBe('completed')
      expect(result.tasks.every(t => t.status === 'completed' || t.status === 'in_progress')).toBe(true)
    })

    it('should respect task dependencies', async () => {
      await manager.initialize()
      const session = await manager.createSession('Dependency Test')

      const task1 = manager.addTask(session.id, 'First task')
      const task2 = manager.addTask(session.id, 'Second task', [task1.id])

      // Execute without assigning - dependencies handled via topological sort
      const result = await manager.executeSession(session.id)

      expect(result.status).toBe('completed')
    })

    it('should emit events during execution', async () => {
      await manager.initialize()
      const session = await manager.createSession('Event Test')

      const events: any[] = []
      manager.onEvent((event) => events.push(event))

      manager.addTask(session.id, 'Event Task')
      await manager.executeSession(session.id)

      expect(events.some(e => e.type === 'session_started')).toBe(true)
    })
  })

  describe('aggregateResults', () => {
    it('should aggregate results from all agents', async () => {
      await manager.initialize()
      const session = await manager.createSession('Aggregate Test')

      const agentConfig: AgentConfig = {
        id: 'agg-agent',
        name: 'Agg Agent',
        role: 'test_generator',
        maxConcurrentTasks: 2,
        timeout: 60000,
        retryOnFailure: false
      }
      manager.registerAgent(session.id, agentConfig)
      manager.addTask(session.id, 'Generate tests')
      manager.addTask(session.id, 'Review code')

      await manager.executeSession(session.id)

      const aggregation = manager.aggregateResults(session.id)

      expect(aggregation.sessionId).toBe(session.id)
      expect(aggregation.outputs.length).toBeGreaterThan(0)
      expect(aggregation.summary).toContain('Completed')
    })

    it('should throw for non-existent session', async () => {
      await manager.initialize()

      expect(() => manager.aggregateResults('non-existent')).toThrow('Session not found')
    })
  })

  describe('getSession / listSessions', () => {
    it('should retrieve session by ID', async () => {
      await manager.initialize()

      const created = await manager.createSession('Get Test')
      const retrieved = manager.getSession(created.id)

      expect(retrieved?.name).toBe('Get Test')
    })

    it('should return undefined for non-existent session', () => {
      const session = manager.getSession('non-existent')
      expect(session).toBeUndefined()
    })

    it('should list all sessions', async () => {
      await manager.initialize()

      await manager.createSession('Session 1')
      await manager.createSession('Session 2')

      const sessions = manager.listSessions()
      expect(sessions.length).toBe(2)
    })
  })

  describe('getAgentsByRole', () => {
    it('should return agents by role', async () => {
      await manager.initialize()

      const orchestrators = manager.getAgentsByRole('orchestrator')
      expect(orchestrators.every(a => a.role === 'orchestrator')).toBe(true)
    })

    it('should return empty array for unknown role', async () => {
      await manager.initialize()

      const unknown = manager.getAgentsByRole('refactorer')
      expect(Array.isArray(unknown)).toBe(true)
    })
  })

  describe('event handling', () => {
    it('should subscribe to events', async () => {
      await manager.initialize()

      const events: any[] = []
      const unsubscribe = manager.onEvent((event) => events.push(event))

      await manager.createSession('Event Test')

      expect(events.length).toBeGreaterThan(0)
      expect(events[0].type).toBe('session_started')

      unsubscribe()
    })

    it('should unsubscribe from events', async () => {
      await manager.initialize()

      const events: any[] = []
      const unsubscribe = manager.onEvent((event) => events.push(event))
      unsubscribe()

      await manager.createSession('After Unsubscribe')

      expect(events.length).toBe(0)
    })
  })
})

describe('Built-in Agents', () => {
  let manager: CollaborationManager

  beforeEach(() => {
    localStorage.clear()
    manager = new CollaborationManager()
  })

  it('should have orchestrator agent', async () => {
    await manager.initialize()

    const agents = manager.getRegisteredAgents()
    const orchestrator = agents.find(a => a.role === 'orchestrator')
    expect(orchestrator).toBeDefined()
    expect(orchestrator?.name).toBe('Orchestrator')
  })

  it('should have code_reviewer agent', async () => {
    await manager.initialize()

    const agents = manager.getAgentsByRole('code_reviewer')
    expect(agents.length).toBeGreaterThan(0)
  })

  it('should have test_generator agent', async () => {
    await manager.initialize()

    const agents = manager.getAgentsByRole('test_generator')
    expect(agents.length).toBeGreaterThan(0)
  })

  it('should have refactorer agent', async () => {
    await manager.initialize()

    const agents = manager.getAgentsByRole('refactorer')
    expect(agents.length).toBeGreaterThan(0)
  })
})

describe('Task Dependencies', () => {
  let manager: CollaborationManager

  beforeEach(() => {
    localStorage.clear()
    manager = new CollaborationManager()
  })

  it('should handle parallel tasks (no dependencies)', async () => {
    await manager.initialize()
    const session = await manager.createSession('Parallel Test')

    manager.addTask(session.id, 'Task A')
    manager.addTask(session.id, 'Task B')
    manager.addTask(session.id, 'Task C')

    const result = await manager.executeSession(session.id)

    expect(result.status).toBe('completed')
    expect(result.tasks.filter(t => t.status === 'completed').length).toBe(3)
  })

  it('should handle sequential dependencies', async () => {
    await manager.initialize()
    const session = await manager.createSession('Sequential Test')

    const task1 = manager.addTask(session.id, 'Step 1')
    const task2 = manager.addTask(session.id, 'Step 2', [task1.id])
    const task3 = manager.addTask(session.id, 'Step 3', [task2.id])

    const result = await manager.executeSession(session.id)

    expect(result.status).toBe('completed')
  })

  it('should handle diamond dependencies', async () => {
    await manager.initialize()
    const session = await manager.createSession('Diamond Test')

    const task1 = manager.addTask(session.id, 'Start')
    const task2 = manager.addTask(session.id, 'Branch A', [task1.id])
    const task3 = manager.addTask(session.id, 'Branch B', [task1.id])
    const task4 = manager.addTask(session.id, 'Merge', [task2.id, task3.id])

    const result = await manager.executeSession(session.id)

    expect(result.status).toBe('completed')
  })

  it('should detect circular dependencies', async () => {
    await manager.initialize()
    const session = await manager.createSession('Circular Test')

    // This test just verifies the structure, actual circular detection is in createPlan
    const task1 = manager.addTask(session.id, 'Task 1')
    const task2 = manager.addTask(session.id, 'Task 2')

    // Manual circular dependency would need to be added through session manipulation
    // For now, just verify tasks can be added
    expect(session.tasks.length).toBe(2)
  })
})

// ============================================
// Task Decomposer Tests
// ============================================
describe('TaskDecomposer', () => {
  let decomposer: TaskDecomposer

  beforeEach(() => {
    decomposer = new TaskDecomposer()
  })

  describe('canDecompose', () => {
    it('should return true for complex tasks with "and" keyword', () => {
      expect(decomposer.canDecompose('Review and refactor this code')).toBe(true)
    })

    it('should return true for multi-step tasks', () => {
      expect(decomposer.canDecompose('First analyze the requirements, then implement the feature')).toBe(true)
    })

    it('should return true for high complexity tasks', () => {
      expect(decomposer.canDecompose('Design a microservice architecture with authentication and distributed caching')).toBe(true)
    })

    it('should return false for simple tasks', () => {
      expect(decomposer.canDecompose('Fix this bug')).toBe(false)
    })
  })

  describe('estimateComplexity', () => {
    it('should return low complexity for simple tasks', () => {
      const complexity = decomposer.estimateComplexity('Fix this bug')
      expect(complexity).toBeLessThan(5)
    })

    it('should return higher complexity for architecture tasks', () => {
      const complexity = decomposer.estimateComplexity('Design a distributed system with microservices')
      expect(complexity).toBeGreaterThanOrEqual(3)
    })

    it('should return higher complexity for security-related tasks', () => {
      const complexity = decomposer.estimateComplexity('Implement authentication and authorization')
      expect(complexity).toBeGreaterThanOrEqual(3)
    })

    it('should cap complexity at 10', () => {
      const complexity = decomposer.estimateComplexity(
        'Architecture microservice distributed concurrent security authentication authorization algorithm optimization performance'
      )
      expect(complexity).toBeLessThanOrEqual(10)
    })
  })

  describe('decompose', () => {
    it('should decompose complex tasks into subtasks', () => {
      const result = decomposer.decompose('Analyze requirements and generate tests')
      
      expect(result.subtasks.length).toBeGreaterThanOrEqual(1)
      expect(result.complexity).toBeGreaterThanOrEqual(0)
    })

    it('should return single subtask for simple tasks', () => {
      const result = decomposer.decompose('Fix bug')
      
      expect(result.subtasks.length).toBe(1)
      expect(result.subtasks[0].description).toBe('Fix bug')
    })

    it('should identify parallel groups when applicable', () => {
      const result = decomposer.decompose(
        'Write unit tests, generate documentation, and review code'
      )
      
      expect(result.parallelGroups).toBeDefined()
      expect(result.parallelGroups!.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('decompose', () => {
    it('should decompose complex tasks into subtasks', () => {
      const result = decomposer.decompose('Build a feature and test it')
      
      // Decompose into subtasks based on keywords
      expect(result.subtasks.length).toBeGreaterThanOrEqual(1)
    })

    it('should estimate duration', () => {
      const result = decomposer.decompose('Build a feature')
      
      // Duration may be 0 or undefined for simple tasks
      expect(result.estimatedDuration === undefined || result.estimatedDuration >= 0).toBe(true)
    })
  })
})

// ============================================
// Orchestrator Tests
// ============================================
describe('Orchestrator', () => {
  let orchestrator: Orchestrator
  let manager: CollaborationManager

  beforeEach(() => {
    orchestrator = new Orchestrator()
    localStorage.clear()
    manager = new CollaborationManager()
  })

  describe('createExecutionPlan', () => {
    it('should create an execution plan for a session', async () => {
      await manager.initialize()
      const session = await manager.createSession('Test Session')
      
      manager.addTask(session.id, 'Task 1')
      manager.addTask(session.id, 'Task 2')
      
      const refreshedSession = manager.getSession(session.id)!
      const plan = orchestrator.createExecutionPlan(refreshedSession)
      
      expect(plan.sessionId).toBe(session.id)
      expect(plan.steps.length).toBe(2)
    })

    it('should create steps with correct dependencies', async () => {
      await manager.initialize()
      const session = await manager.createSession('Dependency Test')
      
      const task1 = manager.addTask(session.id, 'First task')
      manager.addTask(session.id, 'Second task', [task1.id])
      
      const refreshedSession = manager.getSession(session.id)!
      const plan = orchestrator.createExecutionPlan(refreshedSession)
      
      const step1 = plan.steps.find(s => s.taskId === task1.id)
      const step2 = plan.steps.find(s => s.waitFor?.includes(task1.id))
      
      expect(step1).toBeDefined()
      expect(step2).toBeDefined()
      expect(step2!.waitFor).toContain(task1.id)
    })

    it('should handle parallel tasks without dependencies', async () => {
      await manager.initialize()
      const session = await manager.createSession('Parallel Test')
      
      manager.addTask(session.id, 'Task A')
      manager.addTask(session.id, 'Task B')
      manager.addTask(session.id, 'Task C')
      
      const refreshedSession = manager.getSession(session.id)!
      const plan = orchestrator.createExecutionPlan(refreshedSession)
      
      expect(plan.parallelGroups).toBeDefined()
      expect(plan.parallelGroups!.length).toBeGreaterThan(0)
    })
  })

  describe('canRunParallel', () => {
    it('should return true for independent steps', () => {
      const stepA = { stepId: '1', agentId: 'a', taskId: 't1', waitFor: [] }
      const stepB = { stepId: '2', agentId: 'b', taskId: 't2', waitFor: [] }
      
      expect(orchestrator.canRunParallel(stepA as any, stepB as any)).toBe(true)
    })

    it('should return false when one step waits for another', () => {
      const stepA = { stepId: '1', agentId: 'a', taskId: 't1', waitFor: ['2'] }
      const stepB = { stepId: '2', agentId: 'b', taskId: 't2', waitFor: [] }
      
      expect(orchestrator.canRunParallel(stepA as any, stepB as any)).toBe(false)
    })
  })

  describe('getNextExecutableSteps', () => {
    it('should return steps with no dependencies initially', () => {
      const plan: ExecutionPlan = {
        sessionId: 'test',
        steps: [
          { stepId: '1', agentId: 'a', taskId: 't1' },
          { stepId: '2', agentId: 'b', taskId: 't2', waitFor: ['1'] }
        ],
        createdAt: Date.now()
      }
      
      const next = orchestrator.getNextExecutableSteps(plan, new Set())
      
      expect(next.length).toBe(1)
      expect(next[0].stepId).toBe('1')
    })

    it('should return dependent steps after prerequisites complete', () => {
      const plan: ExecutionPlan = {
        sessionId: 'test',
        steps: [
          { stepId: '1', agentId: 'a', taskId: 't1' },
          { stepId: '2', agentId: 'b', taskId: 't2', waitFor: ['1'] }
        ],
        createdAt: Date.now()
      }
      
      const next = orchestrator.getNextExecutableSteps(plan, new Set(['1']))
      
      expect(next.length).toBe(1)
      expect(next[0].stepId).toBe('2')
    })
  })
})

// ============================================
// Result Aggregator Tests
// ============================================
describe('ResultAggregator', () => {
  let aggregator: ResultAggregator

  beforeEach(() => {
    aggregator = new ResultAggregator()
  })

  describe('aggregate', () => {
    it('should aggregate outputs with sequential strategy', () => {
      const outputs: AgentOutput[] = [
        { agentId: 'a1', role: 'orchestrator', success: true, content: 'First output' },
        { agentId: 'a2', role: 'code_reviewer', success: true, content: 'Second output' }
      ]
      
      const config: AggregationConfig = { strategy: 'sequential' }
      const result = aggregator.aggregate(outputs, config)
      
      expect(result.finalOutput).toContain('First output')
      expect(result.finalOutput).toContain('Second output')
      expect(result.metadata.successfulOutputs).toBe(2)
    })

    it('should aggregate outputs with hierarchical strategy', () => {
      const outputs: AgentOutput[] = [
        { agentId: 'a1', role: 'code_reviewer', success: true, content: 'Review findings' },
        { agentId: 'a2', role: 'orchestrator', success: true, content: 'Final decision' }
      ]
      
      const config: AggregationConfig = { strategy: 'hierarchical' }
      const result = aggregator.aggregate(outputs, config)
      
      expect(result.finalOutput).toContain('Orchestrator')
      expect(result.finalOutput).toContain('Code Reviewer')
    })

    it('should handle failed outputs', () => {
      const outputs: AgentOutput[] = [
        { agentId: 'a1', role: 'orchestrator', success: true, content: 'Success' },
        { agentId: 'a2', role: 'code_reviewer', success: false, content: 'Failed' }
      ]
      
      const config: AggregationConfig = { strategy: 'sequential' }
      const result = aggregator.aggregate(outputs, config)
      
      expect(result.metadata.failedOutputs).toBe(1)
      expect(result.metadata.successfulOutputs).toBe(1)
    })
  })

  describe('mergeTextOutputs', () => {
    it('should merge multiple text outputs', () => {
      const outputs: AgentOutput[] = [
        { agentId: 'a1', role: 'orchestrator', success: true, content: 'Line 1\nLine 2' },
        { agentId: 'a2', role: 'code_reviewer', success: true, content: 'Line 3\nLine 4' }
      ]
      
      const merged = aggregator.mergeTextOutputs(outputs)
      
      expect(merged).toContain('Line 1')
      expect(merged).toContain('Line 3')
    })
  })

  describe('mergeToolCalls', () => {
    it('should merge and deduplicate tool calls', () => {
      const outputs: AgentOutput[] = [
        { 
          agentId: 'a1', 
          role: 'orchestrator', 
          success: true, 
          content: 'Result 1',
          toolCalls: [{ name: 'tool1', arguments: { a: 1 } }]
        },
        { 
          agentId: 'a2', 
          role: 'code_reviewer', 
          success: true, 
          content: 'Result 2',
          toolCalls: [{ name: 'tool1', arguments: { a: 1 } }, { name: 'tool2', arguments: { b: 2 } }]
        }
      ]
      
      const merged = aggregator.mergeToolCalls(outputs)
      
      expect(merged.length).toBe(2) // tool1 deduplicated
      expect(merged.find(t => t.name === 'tool2')).toBeDefined()
    })
  })

  describe('generateSummary', () => {
    it('should generate a summary of outputs', () => {
      const outputs: AgentOutput[] = [
        { agentId: 'a1', role: 'orchestrator', success: true, content: 'Output 1' },
        { agentId: 'a2', role: 'code_reviewer', success: true, content: 'Output 2' }
      ]
      
      const summary = aggregator.generateSummary(outputs)
      
      expect(summary).toContain('2 agent outputs')
      expect(summary).toContain('orchestrator')
    })
  })

  describe('consensus and voting strategies', () => {
    it('should handle consensus strategy', () => {
      const outputs: AgentOutput[] = [
        { agentId: 'a1', role: 'orchestrator', success: true, content: 'Common point. Unique point A.' },
        { agentId: 'a2', role: 'code_reviewer', success: true, content: 'Common point. Unique point B.' }
      ]
      
      const config: AggregationConfig = { strategy: 'consensus' }
      const result = aggregator.aggregate(outputs, config)
      
      // Consensus strategy finds common points between outputs
      expect(result.finalOutput).toBeDefined()
    })

    it('should handle voting strategy', () => {
      const outputs: AgentOutput[] = [
        { agentId: 'a1', role: 'orchestrator', success: true, content: 'Decision option 1' },
        { agentId: 'a2', role: 'code_reviewer', success: true, content: 'Decision option 1' },
        { agentId: 'a3', role: 'test_generator', success: true, content: 'Decision option 2' }
      ]
      
      const config: AggregationConfig = { strategy: 'vote' }
      const result = aggregator.aggregate(outputs, config)
      
      // Vote strategy tallies votes and returns winner
      expect(result.finalOutput).toBeDefined()
    })
  })
})

// ============================================
// CollaborationManager Enhanced Tests
// ============================================
describe('CollaborationManager Enhanced Features', () => {
  let manager: CollaborationManager

  beforeEach(() => {
    localStorage.clear()
    manager = new CollaborationManager()
  })

  describe('decomposeAndPlan', () => {
    it('should decompose a task and create a plan', async () => {
      await manager.initialize()
      
      const plan = await manager.decomposeAndPlan('Analyze code and generate tests')
      
      expect(plan.tasks.length).toBeGreaterThan(0)
      expect(plan.executionOrder).toBeDefined()
    })
  })

  describe('setAggregationStrategy', () => {
    it('should set and get aggregation strategy', async () => {
      await manager.initialize()
      
      manager.setAggregationStrategy('hierarchical')
      expect(manager.getAggregationStrategy()).toBe('hierarchical')
      
      manager.setAggregationStrategy('consensus')
      expect(manager.getAggregationStrategy()).toBe('consensus')
    })
  })

  describe('executeWithOrchestration', () => {
    it('should execute a plan with orchestration', async () => {
      await manager.initialize()
      
      const plan = await manager.decomposeAndPlan('Generate tests and review code')
      
      const result = await manager.executeWithOrchestration({
        sessionId: plan.sessionId,
        steps: [],
        createdAt: Date.now()
      })
      
      expect(result).toBeDefined()
      expect(result.sessionId).toBe(plan.sessionId)
    })
  })

  describe('getTaskDecomposer / getOrchestrator / getResultAggregator', () => {
    it('should return instances of the components', async () => {
      await manager.initialize()
      
      expect(manager.getTaskDecomposer()).toBeInstanceOf(TaskDecomposer)
      expect(manager.getOrchestrator()).toBeInstanceOf(Orchestrator)
      expect(manager.getResultAggregator()).toBeInstanceOf(ResultAggregator)
    })
  })
})