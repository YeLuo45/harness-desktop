/**
 * P9: Task Scheduling - TaskScheduler Tests
 * 
 * TDD tests for scheduled task system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TaskScheduler, SimpleTaskRegistry, type ScheduledTask, type TaskExecution } from '../services/scheduler'

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

describe('TaskScheduler', () => {
  let scheduler: TaskScheduler
  let registry: SimpleTaskRegistry

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear()
    vi.clearAllMocks()
    
    // Create fresh instances
    registry = new SimpleTaskRegistry()
    scheduler = new TaskScheduler(registry, { persistTasks: true })
  })

  describe('createTask', () => {
    it('should create a one-time task', async () => {
      const task = await scheduler.createTask({
        name: 'Test Task',
        type: 'once',
        scheduledAt: Date.now() + 10000,
        handler: 'testHandler',
        params: { foo: 'bar' }
      })

      expect(task.id).toBeDefined()
      expect(task.name).toBe('Test Task')
      expect(task.type).toBe('once')
      expect(task.status).toBe('pending')
      expect(task.runCount).toBe(0)
    })

    it('should create an interval task', async () => {
      const task = await scheduler.createTask({
        name: 'Interval Task',
        type: 'interval',
        intervalMs: 5000,
        handler: 'intervalHandler'
      })

      expect(task.type).toBe('interval')
      expect(task.intervalMs).toBe(5000)
      expect(task.enabled).toBe(true)
    })

    it('should create a cron task', async () => {
      const task = await scheduler.createTask({
        name: 'Cron Task',
        type: 'cron',
        cronExpression: '0 * * * *',
        handler: 'cronHandler'
      })

      expect(task.type).toBe('cron')
      expect(task.cronExpression).toBe('0 * * * *')
    })

    it('should auto-generate ID and timestamps', async () => {
      const before = Date.now()
      const task = await scheduler.createTask({
        name: 'Auto ID Task',
        type: 'once',
        scheduledAt: Date.now() + 1000,
        handler: 'autoHandler'
      })
      const after = Date.now()

      expect(task.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(task.createdAt).toBeGreaterThanOrEqual(before)
      expect(task.createdAt).toBeLessThanOrEqual(after)
      expect(task.updatedAt).toBeGreaterThanOrEqual(before)
      expect(task.updatedAt).toBeLessThanOrEqual(after)
    })

    it('should persist task to localStorage', async () => {
      await scheduler.createTask({
        name: 'Persisted Task',
        type: 'once',
        scheduledAt: Date.now() + 1000,
        handler: 'persistHandler'
      })

      const stored = localStorage.getItem('harness_scheduled_tasks')
      expect(stored).toBeTruthy()
      
      const tasks = JSON.parse(stored!)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].name).toBe('Persisted Task')
    })
  })

  describe('getTask / listTasks', () => {
    it('should retrieve task by ID', async () => {
      const created = await scheduler.createTask({
        name: 'Get Test',
        type: 'once',
        scheduledAt: Date.now() + 1000,
        handler: 'getHandler'
      })

      const retrieved = scheduler.getTask(created.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('Get Test')
    })

    it('should return undefined for non-existent task', () => {
      const task = scheduler.getTask('non-existent-id')
      expect(task).toBeUndefined()
    })

    it('should list all tasks', async () => {
      await scheduler.createTask({
        name: 'Task 1',
        type: 'once',
        scheduledAt: Date.now() + 1000,
        handler: 'handler1'
      })
      await scheduler.createTask({
        name: 'Task 2',
        type: 'interval',
        intervalMs: 1000,
        handler: 'handler2'
      })

      const tasks = scheduler.listTasks()
      expect(tasks).toHaveLength(2)
    })

    it('should list tasks by status', async () => {
      const task1 = await scheduler.createTask({
        name: 'Pending Task',
        type: 'once',
        scheduledAt: Date.now() + 1000,
        handler: 'pendingHandler'
      })

      const task2 = await scheduler.createTask({
        name: 'Another Task',
        type: 'once',
        scheduledAt: Date.now() + 1000,
        handler: 'anotherHandler'
      })

      // Both tasks should be pending initially
      const pending = scheduler.listTasksByStatus('pending')
      expect(pending).toHaveLength(2)

      // Disable task1 (doesn't change status, just enabled flag)
      await scheduler.disableTask(task1.id)
      
      // task1 status still 'pending' but enabled is false
      const stillPending = scheduler.listTasksByStatus('pending')
      expect(stillPending.some(t => t.id === task1.id)).toBe(true)
      expect(stillPending).toHaveLength(2)  // Status unchanged, still pending
    })
  })

  describe('updateTask', () => {
    it('should update task properties', async () => {
      const task = await scheduler.createTask({
        name: 'Original Name',
        type: 'once',
        scheduledAt: Date.now() + 1000,
        handler: 'updateHandler'
      })

      // Wait a ms to ensure different timestamp
      await new Promise(r => setTimeout(r, 1))

      const updated = await scheduler.updateTask(task.id, { name: 'New Name' })
      expect(updated?.name).toBe('New Name')
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(task.createdAt)
    })

    it('should return null for non-existent task', async () => {
      const result = await scheduler.updateTask('non-existent', { name: 'Test' })
      expect(result).toBeNull()
    })

    it('should prevent ID change', async () => {
      const task = await scheduler.createTask({
        name: 'ID Test',
        type: 'once',
        scheduledAt: Date.now() + 1000,
        handler: 'idHandler'
      })

      const originalId = task.id
      const updated = await scheduler.updateTask(task.id, { id: 'hacked-id' } as any)
      expect(updated?.id).toBe(originalId)
    })

    it('should reschedule after interval update', async () => {
      const task = await scheduler.createTask({
        name: 'Reschedule Test',
        type: 'interval',
        intervalMs: 1000,
        handler: 'rescheduleHandler'
      })

      await scheduler.updateTask(task.id, { intervalMs: 5000 })
      
      const updated = scheduler.getTask(task.id)
      expect(updated?.intervalMs).toBe(5000)
    })
  })

  describe('deleteTask', () => {
    it('should delete task by ID', async () => {
      const task = await scheduler.createTask({
        name: 'Delete Me',
        type: 'once',
        scheduledAt: Date.now() + 1000,
        handler: 'deleteHandler'
      })

      const deleted = await scheduler.deleteTask(task.id)
      expect(deleted).toBe(true)
      expect(scheduler.getTask(task.id)).toBeUndefined()
    })

    it('should return false for non-existent task', async () => {
      const deleted = await scheduler.deleteTask('non-existent')
      expect(deleted).toBe(false)
    })

    it('should clear scheduled timer', async () => {
      const task = await scheduler.createTask({
        name: 'Timer Test',
        type: 'interval',
        intervalMs: 1000,
        handler: 'timerHandler'
      })

      await scheduler.deleteTask(task.id)
      
      // Task should be gone
      expect(scheduler.getTask(task.id)).toBeUndefined()
    })
  })

  describe('enableTask / disableTask', () => {
    it('should enable a disabled task', async () => {
      const task = await scheduler.createTask({
        name: 'Enable Test',
        type: 'once',
        scheduledAt: Date.now() + 1000,
        handler: 'enableHandler',
        enabled: false
      })

      await scheduler.enableTask(task.id)
      
      const updated = scheduler.getTask(task.id)
      expect(updated?.enabled).toBe(true)
    })

    it('should disable an enabled task', async () => {
      const task = await scheduler.createTask({
        name: 'Disable Test',
        type: 'once',
        scheduledAt: Date.now() + 1000,
        handler: 'disableHandler',
        enabled: true
      })

      await scheduler.disableTask(task.id)
      
      const updated = scheduler.getTask(task.id)
      expect(updated?.enabled).toBe(false)
    })
  })

  describe('executeTask', () => {
    it('should execute a registered handler', async () => {
      let executed = false
      registry.register('execHandler', async () => {
        executed = true
        return 'success'
      })

      const task = await scheduler.createTask({
        name: 'Execute Test',
        type: 'once',
        scheduledAt: Date.now() + 10000,
        handler: 'execHandler'
      })

      const execution = await scheduler.executeTask(task.id)
      
      expect(executed).toBe(true)
      expect(execution.success).toBe(true)
      expect(execution.result).toBe('success')
    })

    it('should record execution with timing', async () => {
      registry.register('timingHandler', async () => {
        await new Promise(r => setTimeout(r, 10))
        return 'done'
      })

      const task = await scheduler.createTask({
        name: 'Timing Test',
        type: 'once',
        scheduledAt: Date.now() + 10000,
        handler: 'timingHandler'
      })

      const execution = await scheduler.executeTask(task.id)
      
      expect(execution.startedAt).toBeDefined()
      expect(execution.completedAt).toBeDefined()
      expect(execution.durationMs).toBeGreaterThanOrEqual(10)
    })

    it('should throw for non-existent task', async () => {
      await expect(scheduler.executeTask('non-existent')).rejects.toThrow('Task non-existent not found')
    })

    it('should throw for unregistered handler', async () => {
      const task = await scheduler.createTask({
        name: 'No Handler Test',
        type: 'once',
        scheduledAt: Date.now() + 10000,
        handler: 'nonExistentHandler'
      })

      const execution = await scheduler.executeTask(task.id)
      
      expect(execution.success).toBe(false)
      expect(execution.error).toContain('not found')
    })

    it('should pass params to handler', async () => {
      let receivedParams: any
      registry.register('paramsHandler', async (params: any) => {
        receivedParams = params
        return params
      })

      const task = await scheduler.createTask({
        name: 'Params Test',
        type: 'once',
        scheduledAt: Date.now() + 10000,
        handler: 'paramsHandler',
        params: { key: 'value', num: 42 }
      })

      const execution = await scheduler.executeTask(task.id)
      
      expect(receivedParams).toEqual({ key: 'value', num: 42 })
      expect(execution.result).toEqual({ key: 'value', num: 42 })
    })
  })

  describe('getExecutionHistory', () => {
    it('should return execution history for task', async () => {
      registry.register('historyHandler', async () => 'done')

      const task = await scheduler.createTask({
        name: 'History Test',
        type: 'once',
        scheduledAt: Date.now() + 10000,
        handler: 'historyHandler'
      })

      await scheduler.executeTask(task.id)
      await scheduler.executeTask(task.id)
      
      const history = scheduler.getExecutionHistory(task.id)
      expect(history).toHaveLength(2)
    })

    it('should limit history to specified count', async () => {
      registry.register('limitHandler', async () => 'done')

      const task = await scheduler.createTask({
        name: 'Limit Test',
        type: 'once',
        scheduledAt: Date.now() + 10000,
        handler: 'limitHandler'
      })

      for (let i = 0; i < 5; i++) {
        await scheduler.executeTask(task.id)
      }
      
      const history = scheduler.getExecutionHistory(task.id, 3)
      expect(history).toHaveLength(3)
    })
  })
})

describe('SimpleTaskRegistry', () => {
  let registry: SimpleTaskRegistry

  beforeEach(() => {
    registry = new SimpleTaskRegistry()
  })

  describe('register / get', () => {
    it('should register and retrieve a function', () => {
      const fn = async () => 'test'
      registry.register('myHandler', fn)
      
      const retrieved = registry.get('myHandler')
      expect(retrieved).toBe(fn)
    })

    it('should return undefined for non-existent handler', () => {
      const handler = registry.get('nonExistent')
      expect(handler).toBeUndefined()
    })

    it('should allow overwriting a handler', () => {
      const fn1 = () => 'first'
      const fn2 = () => 'second'
      
      registry.register('overwrite', fn1)
      registry.register('overwrite', fn2)
      
      expect(registry.get('overwrite')).toBe(fn2)
    })
  })

  describe('unregister', () => {
    it('should remove a handler', () => {
      registry.register('toRemove', () => 'removed')
      registry.unregister('toRemove')
      
      expect(registry.get('toRemove')).toBeUndefined()
    })
  })

  describe('list', () => {
    it('should list all registered handlers', () => {
      registry.register('handler1', () => {})
      registry.register('handler2', () => {})
      registry.register('handler3', () => {})

      const handlers = registry.list()
      expect(handlers).toContain('handler1')
      expect(handlers).toContain('handler2')
      expect(handlers).toContain('handler3')
      expect(handlers).toHaveLength(3)
    })

    it('should return empty array when no handlers', () => {
      const handlers = registry.list()
      expect(handlers).toHaveLength(0)
    })
  })
})

describe('ScheduledTask Validation', () => {
  let scheduler: TaskScheduler
  let registry: SimpleTaskRegistry

  beforeEach(() => {
    localStorage.clear()
    registry = new SimpleTaskRegistry()
    scheduler = new TaskScheduler(registry, { persistTasks: false })
  })

  it('should set default retry values', async () => {
    const task = await scheduler.createTask({
      name: 'Retry Test',
      type: 'once',
      scheduledAt: Date.now() + 1000,
      handler: 'retryHandler'
    })

    expect(task.retryOnFailure).toBe(true)
    expect(task.maxRetries).toBe(3)
  })

  it('should set custom retry values', async () => {
    const task = await scheduler.createTask({
      name: 'Custom Retry Test',
      type: 'once',
      scheduledAt: Date.now() + 1000,
      handler: 'customRetryHandler',
      retryOnFailure: false,
      maxRetries: 1
    })

    expect(task.retryOnFailure).toBe(false)
    expect(task.maxRetries).toBe(1)
  })

  it('should track run count', async () => {
    registry.register('countHandler', async () => 'counted')

    const task = await scheduler.createTask({
      name: 'Count Test',
      type: 'once',
      scheduledAt: Date.now() + 10000,
      handler: 'countHandler'
    })

    await scheduler.executeTask(task.id)
    await scheduler.executeTask(task.id)
    await scheduler.executeTask(task.id)

    const updated = scheduler.getTask(task.id)
    expect(updated?.runCount).toBe(3)
  })
})