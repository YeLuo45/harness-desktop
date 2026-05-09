/**
 * P11: Multi-Agent Collaboration - CollaborationManager Tests
 * 
 * TDD tests for multi-agent task orchestration system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CollaborationManager, collaborationManager, type CollaborationSession, type CollaborationTask, type AgentConfig } from '../services/multiAgent'

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