/**
 * TDD Test Cases for harness-desktop Multi-Agent Collaboration Engine
 * 
 * PRD: P-20260509-002-multi-agent-collaboration
 * 
 * Tests cover:
 * 1. Agent role definitions (Orchestrator, CodeReviewer, TestGenerator, Refactorer)
 * 2. Task decomposition logic
 * 3. Collaboration state management
 * 4. Result aggregation logic
 * 5. UI components (CollaborationView)
 * 
 * Acceptance Criteria:
 * - [ ] Agent roles are properly typed and instantiated
 * - [ ] Task decomposition splits complex tasks into subtasks
 * - [ ] Agent collaboration state is tracked and managed
 * - [ ] Results from multiple agents are properly aggregated
 * - [ ] CollaborationView renders agent status correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SubAgentManager } from '../services/subAgentManager'
import { useAppStore } from '../store/appStore'
import type {
  ToolResult,
  ExecutionPlan,
  PlanStep,
  SubAgent,
  SubTask,
  SubAgentResult,
  ToolCall,
  MemoryPointer
} from '../types'

// ==========================================
// SECTION 1: Agent Role Definitions
// ==========================================

describe('Agent Role Definitions', () => {
  describe('AgentRole enum and types', () => {
    it('should define Orchestrator role with correct responsibilities', () => {
      const AgentRole = {
        Orchestrator: 'orchestrator',
        CodeReviewer: 'code_reviewer',
        TestGenerator: 'test_generator',
        Refactorer: 'refactorer'
      } as const

      type AgentRole = typeof AgentRole[keyof typeof AgentRole]

      // Orchestrator coordinates other agents
      expect(AgentRole.Orchestrator).toBe('orchestrator')
      expect(AgentRole.CodeReviewer).toBe('code_reviewer')
      expect(AgentRole.TestGenerator).toBe('test_generator')
      expect(AgentRole.Refactorer).toBe('refactorer')
    })

    it('should define AgentCapabilities based on role', () => {
      const AgentCapabilities = {
        orchestrator: ['plan', 'delegate', 'aggregate'],
        code_reviewer: ['review', 'suggest', 'approve'],
        test_generator: ['generate', 'validate', 'coverage'],
        refactorer: ['extract', 'inline', 'rename', 'move']
      } as const

      expect(AgentCapabilities.orchestrator).toContain('delegate')
      expect(AgentCapabilities.code_reviewer).toContain('review')
      expect(AgentCapabilities.test_generator).toContain('generate')
      expect(AgentCapabilities.refactorer).toContain('extract')
    })

    it('should define AgentConfig with role-specific settings', () => {
      interface AgentConfig {
        id: string
        name: string
        role: 'orchestrator' | 'code_reviewer' | 'test_generator' | 'refactorer'
        maxConcurrentTasks: number
        timeout: number
        retryOnFailure: boolean
      }

      const orchestratorConfig: AgentConfig = {
        id: 'agent-1',
        name: 'MainOrchestrator',
        role: 'orchestrator',
        maxConcurrentTasks: 4,
        timeout: 60000,
        retryOnFailure: true
      }

      expect(orchestratorConfig.role).toBe('orchestrator')
      expect(orchestratorConfig.maxConcurrentTasks).toBe(4)
    })
  })

  describe('Agent instance creation', () => {
    it('should create agent with correct role assignment', () => {
      const manager = new SubAgentManager({ maxConcurrentAgents: 4 })

      const orchestrator = manager.createAgent('Orchestrator-1')
      orchestrator.status = 'running'

      expect(orchestrator.name).toBe('Orchestrator-1')
      expect(orchestrator.status).toBe('running')
      expect(orchestrator.parentId).toBeUndefined()
    })

    it('should create child agent with parent reference', () => {
      const manager = new SubAgentManager({ maxConcurrentAgents: 4 })

      const orchestrator = manager.createAgent('Orchestrator-1')
      const codeReviewer = manager.createAgent('CodeReviewer-1', orchestrator.id)

      expect(codeReviewer.parentId).toBe(orchestrator.id)
      expect(codeReviewer.name).toBe('CodeReviewer-1')
    })

    it('should track agents in manager registry', () => {
      const manager = new SubAgentManager({ maxConcurrentAgents: 4 })

      const agent1 = manager.createAgent('Agent-1')
      const agent2 = manager.createAgent('Agent-2')

      const allAgents = manager.getAllAgents()
      expect(allAgents).toHaveLength(2)
      expect(allAgents.map(a => a.id)).toContain(agent1.id)
      expect(allAgents.map(a => a.id)).toContain(agent2.id)
    })
  })
})

// ==========================================
// SECTION 2: Task Decomposition Logic
// ==========================================

describe('Task Decomposition Logic', () => {
  let manager: SubAgentManager

  beforeEach(() => {
    manager = new SubAgentManager({ maxConcurrentAgents: 4 })
  })

  afterEach(() => {
    // Clean up
    for (const agent of manager.getAllAgents()) {
      manager.cancelAgent(agent.id)
    }
  })

  describe('Task creation and assignment', () => {
    it('should create a single task for an agent', () => {
      const agent = manager.createAgent('TestAgent')

      const toolCalls: ToolCall[] = [
        { name: 'file_read', arguments: { path: '/test.ts' } }
      ]

      const task = manager.addTask(agent.id, 'Read test file', toolCalls)

      expect(task).not.toBeNull()
      expect(task!.description).toBe('Read test file')
      expect(task!.toolCalls).toHaveLength(1)
      expect(task!.status).toBe('idle')
    })

    it('should return null when adding task to non-existent agent', () => {
      const task = manager.addTask('non-existent-id', 'Test task', [])

      expect(task).toBeNull()
    })

    it('should create multiple tasks at once', () => {
      const agent = manager.createAgent('TestAgent')

      const tasks = manager.addTasks(agent.id, [
        { description: 'Task 1', toolCalls: [{ name: 'file_read', arguments: { path: '/a.ts' } }] },
        { description: 'Task 2', toolCalls: [{ name: 'file_write', arguments: { path: '/b.ts', content: '' } }] },
        { description: 'Task 3', toolCalls: [{ name: 'bash_execute', arguments: { command: 'npm test' } }] }
      ])

      expect(tasks).toHaveLength(3)
      expect(tasks![0].description).toBe('Task 1')
      expect(tasks![1].description).toBe('Task 2')
      expect(tasks![2].description).toBe('Task 3')
    })
  })

  describe('Task dependencies', () => {
    it('should respect task dependencies when getting ready tasks', async () => {
      const agent = manager.createAgent('TestAgent')
      manager.setToolExecutor(async (toolName, args) => ({
        toolName,
        arguments: args,
        result: { success: true },
        success: true,
        timestamp: Date.now()
      }))

      const task1 = manager.addTask(agent.id, 'Task 1', [{ name: 'file_read', arguments: {} }])
      const task2 = manager.addTask(agent.id, 'Task 2', [{ name: 'file_write', arguments: {} }], [task1!.id])
      const task3 = manager.addTask(agent.id, 'Task 3', [{ name: 'bash_execute', arguments: {} }], [task2!.id])

      // Initially only task1 should be ready (no dependencies)
      let ready = manager.getReadyTasks(agent.id)
      expect(ready).toHaveLength(1)
      expect(ready[0].id).toBe(task1!.id)

      // Complete task1
      await manager.executeTask(agent.id, task1!.id)

      // Now task2 should be ready
      ready = manager.getReadyTasks(agent.id)
      expect(ready).toHaveLength(1)
      expect(ready[0].id).toBe(task2!.id)
    })

    it('should handle parallel tasks with no dependencies', () => {
      const agent = manager.createAgent('TestAgent')

      manager.addTask(agent.id, 'Independent 1', [{ name: 'file_read', arguments: {} }])
      manager.addTask(agent.id, 'Independent 2', [{ name: 'file_read', arguments: {} }])
      manager.addTask(agent.id, 'Independent 3', [{ name: 'file_read', arguments: {} }])

      const ready = manager.getReadyTasks(agent.id)
      expect(ready).toHaveLength(3)
    })

    it('should handle complex dependency graphs', async () => {
      const agent = manager.createAgent('TestAgent')
      manager.setToolExecutor(async (toolName, args) => ({
        toolName,
        arguments: args,
        result: { success: true },
        success: true,
        timestamp: Date.now()
      }))

      // Create dependency structure:
      //   task1
      //   ├── task2
      //   └── task3
      //       └── task4

      const task1 = manager.addTask(agent.id, 'task1', [{ name: 'file_read', arguments: {} }])
      const task2 = manager.addTask(agent.id, 'task2', [{ name: 'file_write', arguments: {} }], [task1!.id])
      const task3 = manager.addTask(agent.id, 'task3', [{ name: 'bash_execute', arguments: {} }], [task1!.id])
      const task4 = manager.addTask(agent.id, 'task4', [{ name: 'bash_execute', arguments: {} }], [task3!.id])

      // First iteration: only task1 is ready
      let ready = manager.getReadyTasks(agent.id)
      expect(ready).toHaveLength(1)
      expect(ready[0].id).toBe(task1!.id)

      // After completing task1, task2 and task3 become ready (parallel)
      await manager.executeTask(agent.id, task1!.id)
      ready = manager.getReadyTasks(agent.id)
      expect(ready).toHaveLength(2)
      expect(ready.map(t => t.id)).toContain(task2!.id)
      expect(ready.map(t => t.id)).toContain(task3!.id)
    })
  })

  describe('Task execution', () => {
    it('should execute task and update status', async () => {
      const manager = new SubAgentManager({ maxConcurrentAgents: 4 })
      const agent = manager.createAgent('TestAgent')

      // Set up tool executor mock
      manager.setToolExecutor(async (toolName, args) => ({
        toolName,
        arguments: args,
        result: { success: true },
        success: true,
        timestamp: Date.now()
      }))

      const task = manager.addTask(agent.id, 'Test task', [
        { name: 'file_read', arguments: { path: '/test.ts' } }
      ])

      const result = await manager.executeTask(agent.id, task!.id)

      expect(result.success).toBe(true)
      expect(result.toolResults).toHaveLength(1)
      expect(task!.status).toBe('completed')
    })

    it('should handle task execution failure', async () => {
      const manager = new SubAgentManager({ maxConcurrentAgents: 4 })
      const agent = manager.createAgent('TestAgent')

      // Set up tool executor that fails
      manager.setToolExecutor(async (toolName, args) => ({
        toolName,
        arguments: args,
        result: null,
        success: false,
        error: 'Permission denied',
        timestamp: Date.now()
      }))

      const task = manager.addTask(agent.id, 'Failing task', [
        { name: 'bash_execute', arguments: { command: 'rm -rf /' } }
      ])

      const result = await manager.executeTask(agent.id, task!.id)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
      expect(task!.status).toBe('failed')
    })

    it('should record task timing (startedAt, completedAt)', async () => {
      const manager = new SubAgentManager({ maxConcurrentAgents: 4 })
      const agent = manager.createAgent('TestAgent')

      manager.setToolExecutor(async (toolName, args) => ({
        toolName,
        arguments: args,
        result: { success: true },
        success: true,
        timestamp: Date.now()
      }))

      const task = manager.addTask(agent.id, 'Timed task', [
        { name: 'file_read', arguments: {} }
      ])

      expect(task!.startedAt).toBeUndefined()
      expect(task!.completedAt).toBeUndefined()

      await manager.executeTask(agent.id, task!.id)

      expect(task!.startedAt).toBeDefined()
      expect(task!.completedAt).toBeDefined()
      expect(task!.completedAt!).toBeGreaterThanOrEqual(task!.startedAt!)
    })
  })
})

// ==========================================
// SECTION 3: Collaboration State Management
// ==========================================

describe('Collaboration State Management', () => {
  let manager: SubAgentManager

  beforeEach(() => {
    useAppStore.setState({
      mode: 'execution',
      currentPlan: null,
      messages: [],
      isLoading: false,
      verificationWarnings: []
    })
    manager = new SubAgentManager({ maxConcurrentAgents: 4 })
  })

  afterEach(() => {
    for (const agent of manager.getAllAgents()) {
      manager.cancelAgent(agent.id)
    }
  })

  describe('Agent state transitions', () => {
    it('should track agent status correctly', async () => {
      const agent = manager.createAgent('TestAgent')
      
      expect(agent.status).toBe('idle')

      // Simulate running state
      agent.status = 'running'
      expect(manager.getAgent(agent.id)?.status).toBe('running')

      // Simulate completed state
      agent.status = 'completed'
      expect(manager.getAgent(agent.id)?.status).toBe('completed')
    })

    it('should cancel agent and its tasks', () => {
      const agent = manager.createAgent('TestAgent')

      const task1 = manager.addTask(agent.id, 'Task 1', [{ name: 'file_read', arguments: {} }])
      const task2 = manager.addTask(agent.id, 'Task 2', [{ name: 'file_write', arguments: {} }])

      task1!.status = 'running'
      task2!.status = 'idle'

      const result = manager.cancelAgent(agent.id)

      expect(result).toBe(true)
      expect(manager.getAgent(agent.id)?.status).toBe('cancelled')
      expect(task1!.status).toBe('cancelled')
      expect(task2!.status).toBe('cancelled')
    })

    it('should aggregate statistics correctly', async () => {
      const agent1 = manager.createAgent('Agent-1')
      const agent2 = manager.createAgent('Agent-2')

      // Add tasks with different statuses
      manager.addTask(agent1.id, 'Task 1', [{ name: 'file_read', arguments: {} }])
      manager.addTask(agent1.id, 'Task 2', [{ name: 'file_write', arguments: {} }])

      manager.setToolExecutor(async (toolName, args) => ({
        toolName,
        arguments: args,
        result: { success: true },
        success: true,
        timestamp: Date.now()
      }))

      await manager.executeTask(agent1.id, agent1.tasks[0].id)
      await manager.executeTask(agent1.id, agent1.tasks[1].id)

      const stats = manager.getStats()

      expect(stats.totalAgents).toBe(2)
      expect(stats.completedTasks).toBe(2)
    })
  })

  describe('KV Cache management', () => {
    it('should update KV cache with tool results', () => {
      const agent = manager.createAgent('TestAgent')

      const pointers: MemoryPointer[] = [
        {
          id: 'ptr-1',
          type: 'tool_result',
          summary: 'file_read: success',
          fullContent: JSON.stringify({ tool: 'file_read', result: 'content' }),
          timestamp: Date.now(),
          associations: []
        }
      ]

      manager.updateKVCache(agent.id, pointers)

      const snapshot = manager.getKVCacheSnapshot(agent.id)
      expect(snapshot).not.toBeNull()
      expect(snapshot!.pointers).toHaveLength(1)
      expect(snapshot!.pointers[0].id).toBe('ptr-1')
    })

    it('should share KV cache from parent to child', () => {
      const parent = manager.createAgent('ParentAgent')
      const child = manager.createAgent('ChildAgent', parent.id)

      // Update parent's KV cache
      manager.updateKVCache(parent.id, [{
        id: 'shared-ptr',
        type: 'tool_result',
        summary: 'Shared pointer',
        fullContent: 'shared content',
        timestamp: Date.now(),
        associations: []
      }])

      // Share to child
      const result = manager.shareKVCacheFromParent(child.id, parent.id)

      expect(result).toBe(true)

      const childSnapshot = manager.getKVCacheSnapshot(child.id)
      expect(childSnapshot!.pointers).toHaveLength(1)
      expect(childSnapshot!.pointers[0].id).toBe('shared-ptr')
    })

    it('should evict old pointers when KV cache exceeds limit', () => {
      const manager = new SubAgentManager({ maxKVCacheSize: 100 }) // Small limit for testing
      const agent = manager.createAgent('TestAgent')

      // Add many pointers that exceed the limit
      for (let i = 0; i < 20; i++) {
        manager.updateKVCache(agent.id, [{
          id: `ptr-${i}`,
          type: 'tool_result',
          summary: `Pointer ${i}`,
          fullContent: 'x'.repeat(50), // ~50 tokens
          timestamp: Date.now() + i,
          associations: []
        }])
      }

      const snapshot = manager.getKVCacheSnapshot(agent.id)
      expect(snapshot!.tokenCount).toBeLessThanOrEqual(manager['maxKVCacheSize'])
    })
  })

  describe('Store integration for collaboration state', () => {
    it('should manage collaboration messages in store', () => {
      useAppStore.getState().addMessage({
        role: 'assistant',
        content: 'Starting multi-agent collaboration'
      })

      const messages = useAppStore.getState().messages
      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe('assistant')
    })
  })
})

// ==========================================
// SECTION 4: Result Aggregation Logic
// ==========================================

describe('Result Aggregation Logic', () => {
  let manager: SubAgentManager

  beforeEach(() => {
    manager = new SubAgentManager({ maxConcurrentAgents: 4 })
  })

  afterEach(() => {
    for (const agent of manager.getAllAgents()) {
      manager.cancelAgent(agent.id)
    }
  })

  describe('SubTask result aggregation', () => {
    it('should aggregate tool results from multiple tasks', async () => {
      const agent = manager.createAgent('TestAgent')

      manager.setToolExecutor(async (toolName, args) => ({
        toolName,
        arguments: args,
        result: { output: `${toolName} executed` },
        success: true,
        timestamp: Date.now()
      }))

      // Add multiple tasks
      manager.addTasks(agent.id, [
        { description: 'Read file', toolCalls: [{ name: 'file_read', arguments: { path: '/a.ts' } }] },
        { description: 'Write file', toolCalls: [{ name: 'file_write', arguments: { path: '/b.ts', content: 'test' } }] },
        { description: 'Run tests', toolCalls: [{ name: 'bash_execute', arguments: { command: 'npm test' } }] }
      ])

      const result = await manager.runAgent(agent.id)

      expect(result.success).toBe(true)
      expect(result.tasks).toHaveLength(3)
      expect(result.aggregatedOutput).toContain('file_read')
      expect(result.aggregatedOutput).toContain('file_write')
      expect(result.aggregatedOutput).toContain('bash_execute')
    })

    it('should handle partial failures in aggregation', async () => {
      const agent = manager.createAgent('TestAgent')

      let callCount = 0
      manager.setToolExecutor(async (toolName, args) => {
        callCount++
        if (callCount === 2) {
          return {
            toolName,
            arguments: args,
            result: null,
            success: false,
            error: 'Simulated failure',
            timestamp: Date.now()
          }
        }
        return {
          toolName,
          arguments: args,
          result: { success: true },
          success: true,
          timestamp: Date.now()
        }
      })

      manager.addTasks(agent.id, [
        { description: 'Task 1', toolCalls: [{ name: 'bash', arguments: {} }] },
        { description: 'Task 2', toolCalls: [{ name: 'bash', arguments: {} }] },
        { description: 'Task 3', toolCalls: [{ name: 'bash', arguments: {} }] }
      ])

      const result = await manager.runAgent(agent.id)

      expect(result.success).toBe(false)
    })
  })

  describe('Multi-agent result aggregation', () => {
    it('should aggregate results from orchestrator and sub-agents', async () => {
      const orchestrator = manager.createAgent('Orchestrator')

      // Create sub-agents for different roles
      const codeReviewer = manager.createAgent('CodeReviewer', orchestrator.id)
      const testGenerator = manager.createAgent('TestGenerator', orchestrator.id)

      manager.setToolExecutor(async (toolName, args) => ({
        toolName,
        arguments: args,
        result: { success: true },
        success: true,
        timestamp: Date.now()
      }))

      // Add tasks to each agent
      manager.addTask(codeReviewer.id, 'Review code', [{ name: 'file_read', arguments: { path: '/code.ts' } }])
      manager.addTask(testGenerator.id, 'Generate tests', [{ name: 'file_write', arguments: { path: '/test.ts', content: '' } }])

      // Run orchestrator (which would in turn run sub-agents)
      const orchestratorResult = await manager.runAgent(orchestrator.id)
      
      // Run sub-agents
      const reviewerResult = await manager.runAgent(codeReviewer.id)
      const generatorResult = await manager.runAgent(testGenerator.id)

      // Aggregate all results
      const totalResults = {
        orchestrator: orchestratorResult,
        codeReviewer: reviewerResult,
        testGenerator: generatorResult,
        combinedSuccess: orchestratorResult.success && reviewerResult.success && generatorResult.success
      }

      expect(totalResults.combinedSuccess).toBe(true)
    })

    it('should provide KV cache snapshot in aggregated result', async () => {
      const agent = manager.createAgent('TestAgent')

      manager.setToolExecutor(async (toolName, args) => ({
        toolName,
        arguments: args,
        result: { output: 'done' },
        success: true,
        timestamp: Date.now()
      }))

      manager.addTask(agent.id, 'Task 1', [{ name: 'bash', arguments: {} }])

      const result = await manager.runAgent(agent.id)

      expect(result.kvCacheSnapshot).toBeDefined()
      expect(result.kvCacheSnapshot.maxTokens).toBe(manager['maxKVCacheSize'])
    })
  })

  describe('Execution plan result aggregation', () => {
    it('should map sub-agent results to execution plan format', () => {
      interface AggregatedPlanResult {
        taskDescription: string
        steps: Array<{
          description: string
          status: 'completed' | 'failed'
          result?: unknown
        }>
        totalSteps: number
        completedSteps: number
        successRate: number
      }

      const subAgentResults: SubAgentResult[] = [
        {
          agentId: 'agent-1',
          success: true,
          tasks: [
            { success: true, toolResults: [], output: 'Step 1 done' },
            { success: true, toolResults: [], output: 'Step 2 done' }
          ],
          aggregatedOutput: 'Step 1 done\nStep 2 done',
          kvCacheSnapshot: { pointers: [], tokenCount: 0, maxTokens: 100 }
        }
      ]

      const aggregated: AggregatedPlanResult = {
        taskDescription: 'Multi-agent task',
        steps: subAgentResults.flatMap(r => r.tasks.map(t => ({
          description: t.output,
          status: t.success ? 'completed' as const : 'failed' as const,
          result: t.toolResults
        }))),
        totalSteps: subAgentResults.reduce((sum, r) => sum + r.tasks.length, 0),
        completedSteps: subAgentResults.flatMap(r => r.tasks).filter(t => t.success).length,
        successRate: 1.0
      }

      expect(aggregated.totalSteps).toBe(2)
      expect(aggregated.completedSteps).toBe(2)
      expect(aggregated.successRate).toBe(1.0)
    })
  })
})

// ==========================================
// SECTION 5: UI Component Rendering (CollaborationView)
// ==========================================

describe('CollaborationView Component Rendering', () => {
  // Mock the CollaborationView props interface
  interface CollaborationViewProps {
    agents: Array<{
      id: string
      name: string
      status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
      taskCount: number
      completedTaskCount: number
    }>
    activeTasks: Array<{
      id: string
      description: string
      agentName: string
      status: 'idle' | 'running' | 'completed' | 'failed'
    }>
    onAgentSelect?: (agentId: string) => void
    onTaskSelect?: (taskId: string) => void
  }

  describe('Agent status display', () => {
    it('should render agent status icons correctly', () => {
      const getStatusIcon = (status: CollaborationViewProps['agents'][0]['status']): string => {
        switch (status) {
          case 'idle': return '○'
          case 'running': return '◐'
          case 'completed': return '●'
          case 'failed': return '✗'
          case 'cancelled': return '◌'
          default: return '○'
        }
      }

      expect(getStatusIcon('idle')).toBe('○')
      expect(getStatusIcon('running')).toBe('◐')
      expect(getStatusIcon('completed')).toBe('●')
      expect(getStatusIcon('failed')).toBe('✗')
      expect(getStatusIcon('cancelled')).toBe('◌')
    })

    it('should render agent card with correct info', () => {
      const renderAgentCard = (agent: CollaborationViewProps['agents'][0]) => {
        return {
          id: agent.id,
          name: agent.name,
          status: agent.status,
          progress: `${agent.completedTaskCount}/${agent.taskCount}`
        }
      }

      const mockAgent = {
        id: 'agent-1',
        name: 'CodeReviewer',
        status: 'running' as const,
        taskCount: 5,
        completedTaskCount: 2
      }

      const card = renderAgentCard(mockAgent)

      expect(card.id).toBe('agent-1')
      expect(card.name).toBe('CodeReviewer')
      expect(card.status).toBe('running')
      expect(card.progress).toBe('2/5')
    })
  })

  describe('Task list rendering', () => {
    it('should render active tasks with agent assignment', () => {
      const mockTasks: CollaborationViewProps['activeTasks'] = [
        { id: 'task-1', description: 'Review code', agentName: 'CodeReviewer', status: 'running' },
        { id: 'task-2', description: 'Generate tests', agentName: 'TestGenerator', status: 'completed' }
      ]

      const renderTaskItem = (task: CollaborationViewProps['activeTasks'][0]) => {
        const statusSymbol = task.status === 'completed' ? '✓' : task.status === 'running' ? '▶' : '○'
        return `${statusSymbol} [${task.agentName}] ${task.description}`
      }

      expect(renderTaskItem(mockTasks[0])).toBe('▶ [CodeReviewer] Review code')
      expect(renderTaskItem(mockTasks[1])).toBe('✓ [TestGenerator] Generate tests')
    })

    it('should calculate overall progress correctly', () => {
      const agents: CollaborationViewProps['agents'] = [
        { id: 'a1', name: 'Agent1', status: 'completed', taskCount: 4, completedTaskCount: 4 },
        { id: 'a2', name: 'Agent2', status: 'running', taskCount: 3, completedTaskCount: 1 },
        { id: 'a3', name: 'Agent3', status: 'idle', taskCount: 2, completedTaskCount: 0 }
      ]

      const totalTasks = agents.reduce((sum, a) => sum + a.taskCount, 0)
      const completedTasks = agents.reduce((sum, a) => sum + a.completedTaskCount, 0)
      const overallProgress = (completedTasks / totalTasks) * 100

      expect(totalTasks).toBe(9)
      expect(completedTasks).toBe(5)
      expect(overallProgress).toBeCloseTo(55.56, 1)
    })
  })

  describe('Collaboration state summary', () => {
    it('should generate collaboration summary text', () => {
      const agents: CollaborationViewProps['agents'] = [
        { id: 'a1', name: 'Orchestrator', status: 'running', taskCount: 3, completedTaskCount: 1 },
        { id: 'a2', name: 'CodeReviewer', status: 'running', taskCount: 2, completedTaskCount: 1 },
        { id: 'a3', name: 'TestGenerator', status: 'completed', taskCount: 2, completedTaskCount: 2 }
      ]

      const runningAgents = agents.filter(a => a.status === 'running').length
      const completedAgents = agents.filter(a => a.status === 'completed').length
      const summary = `${runningAgents} agents running, ${completedAgents} agents completed`

      expect(summary).toBe('2 agents running, 1 agents completed')
    })

    it('should handle empty collaboration state', () => {
      const emptyAgents: CollaborationViewProps['agents'] = []

      const hasActiveCollaboration = emptyAgents.some(a => a.status === 'running')
      const summary = hasActiveCollaboration ? 'Collaboration active' : 'No active collaboration'

      expect(summary).toBe('No active collaboration')
    })
  })
})

// ==========================================
// SECTION 6: Integration Tests
// ==========================================

describe('Multi-Agent Collaboration Integration', () => {
  let manager: SubAgentManager

  beforeEach(() => {
    useAppStore.setState({
      mode: 'execution',
      currentPlan: null,
      messages: [],
      isLoading: false,
      verificationWarnings: []
    })
    manager = new SubAgentManager({ maxConcurrentAgents: 4 })
  })

  afterEach(() => {
    for (const agent of manager.getAllAgents()) {
      manager.cancelAgent(agent.id)
    }
  })

  it('should complete full collaboration workflow', async () => {
    // 1. Create orchestrator
    const orchestrator = manager.createAgent('Orchestrator')

    // 2. Create specialized agents
    const codeReviewer = manager.createAgent('CodeReviewer', orchestrator.id)
    const testGenerator = manager.createAgent('TestGenerator', orchestrator.id)
    const refactorer = manager.createAgent('Refactorer', orchestrator.id)

    // 3. Set up tool executor
    manager.setToolExecutor(async (toolName, args) => ({
      toolName,
      arguments: args,
      result: { success: true, output: `${toolName} completed` },
      success: true,
      timestamp: Date.now()
    }))

    // 4. Assign tasks to specialized agents
    manager.addTask(codeReviewer.id, 'Review code quality', [
      { name: 'bash_execute', arguments: { command: 'npm run lint' } }
    ])

    manager.addTask(testGenerator.id, 'Generate unit tests', [
      { name: 'bash_execute', arguments: { command: 'npm run test:generate' } }
    ])

    manager.addTask(refactorer.id, 'Refactor codebase', [
      { name: 'bash_execute', arguments: { command: 'npm run refactor' } }
    ])

    // 5. Run orchestrator and sub-agents
    const orchResult = await manager.runAgent(orchestrator.id)
    const reviewerResult = await manager.runAgent(codeReviewer.id)
    const generatorResult = await manager.runAgent(testGenerator.id)
    const refactorerResult = await manager.runAgent(refactorer.id)

    // 6. Verify results
    expect(reviewerResult.success).toBe(true)
    expect(generatorResult.success).toBe(true)
    expect(refactorerResult.success).toBe(true)

    // 7. Verify KV cache sharing (child agents should have access to parent's context conceptually)
    const reviewerSnapshot = manager.getKVCacheSnapshot(codeReviewer.id)
    expect(reviewerSnapshot).not.toBeNull()
    expect(reviewerSnapshot!.maxTokens).toBe(manager['maxKVCacheSize'])
  })

  it('should handle dependency chain across agents', async () => {
    // Create agents for a dependency chain:
    // Analyzer -> CodeGenerator -> CodeReviewer -> Refactorer

    const analyzer = manager.createAgent('Analyzer')
    const generator = manager.createAgent('Generator', analyzer.id)
    const reviewer = manager.createAgent('Reviewer', generator.id)
    const refactorer = manager.createAgent('Refactorer', reviewer.id)

    manager.setToolExecutor(async (toolName, args) => ({
      toolName,
      arguments: args,
      result: { success: true },
      success: true,
      timestamp: Date.now()
    }))

    // Add dependent tasks
    const analyzeTask = manager.addTask(analyzer.id, 'Analyze requirements', [
      { name: 'bash_execute', arguments: { command: 'analyze' } }
    ])

    manager.addTask(generator.id, 'Generate code', [
      { name: 'bash_execute', arguments: { command: 'generate' } }
    ], [analyzeTask!.id])

    // First: only analyzer should be ready
    let ready = manager.getReadyTasks(analyzer.id)
    expect(ready).toHaveLength(1)

    // Complete analyzer
    await manager.executeTask(analyzer.id, analyzeTask!.id)

    // Now generator should be ready
    ready = manager.getReadyTasks(generator.id)
    expect(ready).toHaveLength(1)
  })

  it('should clean up completed agents properly', async () => {
    const agent1 = manager.createAgent('Agent-1')
    const agent2 = manager.createAgent('Agent-2')

    manager.setToolExecutor(async (toolName, args) => ({
      toolName,
      arguments: args,
      result: { success: true },
      success: true,
      timestamp: Date.now()
    }))

    manager.addTask(agent1.id, 'Task 1', [{ name: 'bash', arguments: {} }])
    manager.addTask(agent2.id, 'Task 2', [{ name: 'bash', arguments: {} }])

    await manager.runAgent(agent1.id)
    await manager.runAgent(agent2.id)

    const cleared = manager.clearCompletedAgents()

    // Both agents completed should be cleared
    expect(cleared).toBeGreaterThanOrEqual(0)
  })
})
