/**
 * CronStore - Cron Task Persistence
 * 
 * Persists cron tasks and their execution history using IndexedDB
 * for reliable storage across browser sessions.
 */

import type { CronStore, CronTaskRecord, CronExecutionRecord } from './types'
import { createIndexedDBFileStore } from './fileStore'

const TASKS_STORE = 'cron_tasks'
const EXECUTIONS_STORE = 'cron_executions'
const DB_NAME = 'harness-cron'

// In-memory cache for faster access
const taskCache = new Map<string, CronTaskRecord>()
const executionCache = new Map<string, CronExecutionRecord[]>()

/**
 * Create a CronStore backed by IndexedDB
 */
export function createCronStore(): CronStore {
  const taskStore = createIndexedDBFileStore(`${DB_NAME}-tasks`, { extension: '.task.json' })
  const execStore = createIndexedDBFileStore(`${DB_NAME}-executions`, { extension: '.exec.json' })

  return {
    // Task operations
    async getTask(taskId: string): Promise<CronTaskRecord | null> {
      // Check cache first
      if (taskCache.has(taskId)) {
        return taskCache.get(taskId)!
      }
      
      const task = await taskStore.read<CronTaskRecord>(taskId)
      if (task) {
        taskCache.set(taskId, task)
      }
      return task
    },

    async getAllTasks(): Promise<CronTaskRecord[]> {
      const taskIds = await taskStore.list()
      const tasks: CronTaskRecord[] = []
      
      for (const id of taskIds) {
        const task = await this.getTask(id)
        if (task) {
          tasks.push(task)
        }
      }
      
      return tasks
    },

    async getEnabledTasks(): Promise<CronTaskRecord[]> {
      const all = await this.getAllTasks()
      return all.filter(t => t.enabled)
    },

    async saveTask(task: CronTaskRecord): Promise<void> {
      await taskStore.write(task.id, task)
      taskCache.set(task.id, task)
    },

    async updateTask(taskId: string, updates: Partial<CronTaskRecord>): Promise<void> {
      const existing = await this.getTask(taskId)
      if (!existing) {
        throw new Error(`Task not found: ${taskId}`)
      }
      
      const updated: CronTaskRecord = {
        ...existing,
        ...updates,
        id: taskId, // Ensure ID doesn't change
        updatedAt: Date.now()
      }
      
      await this.saveTask(updated)
    },

    async deleteTask(taskId: string): Promise<void> {
      await taskStore.delete(taskId)
      taskCache.delete(taskId)
      
      // Also clear executions for this task
      await this.clearExecutions(taskId)
    },

    // Execution operations
    async getExecutions(taskId: string, limit = 100): Promise<CronExecutionRecord[]> {
      const cached = executionCache.get(taskId)
      if (cached && cached.length > 0) {
        return cached.slice(0, limit)
      }
      
      const execIds = await execStore.list(`${taskId}:`)
      const executions: CronExecutionRecord[] = []
      
      for (const id of execIds) {
        const exec = await execStore.read<CronExecutionRecord>(id)
        if (exec) {
          executions.push(exec)
        }
      }
      
      // Sort by startedAt descending
      executions.sort((a, b) => b.startedAt - a.startedAt)
      
      executionCache.set(taskId, executions)
      return executions.slice(0, limit)
    },

    async saveExecution(execution: CronExecutionRecord): Promise<void> {
      const key = `${execution.taskId}:${execution.id}`
      await execStore.write(key, execution)
      
      // Update cache
      const cached = executionCache.get(execution.taskId) || []
      cached.unshift(execution)
      executionCache.set(execution.taskId, cached)
    },

    async clearExecutions(taskId: string): Promise<void> {
      const execIds = await execStore.list(`${taskId}:`)
      
      for (const id of execIds) {
        await execStore.delete(id)
      }
      
      executionCache.delete(taskId)
    },

    // Utility
    async clear(): Promise<void> {
      await taskStore.clear()
      await execStore.clear()
      taskCache.clear()
      executionCache.clear()
    }
  }
}

/**
 * Create an in-memory only CronStore (for testing or temporary use)
 */
export function createMemoryCronStore(): CronStore {
  const tasks = new Map<string, CronTaskRecord>()
  const executions = new Map<string, CronExecutionRecord[]>()

  return {
    async getTask(taskId: string): Promise<CronTaskRecord | null> {
      return tasks.get(taskId) || null
    },

    async getAllTasks(): Promise<CronTaskRecord[]> {
      return Array.from(tasks.values())
    },

    async getEnabledTasks(): Promise<CronTaskRecord[]> {
      return Array.from(tasks.values()).filter(t => t.enabled)
    },

    async saveTask(task: CronTaskRecord): Promise<void> {
      tasks.set(task.id, task)
    },

    async updateTask(taskId: string, updates: Partial<CronTaskRecord>): Promise<void> {
      const existing = tasks.get(taskId)
      if (!existing) {
        throw new Error(`Task not found: ${taskId}`)
      }
      const updated: CronTaskRecord = { ...existing, ...updates, id: taskId, updatedAt: Date.now() }
      tasks.set(taskId, updated)
    },

    async deleteTask(taskId: string): Promise<void> {
      tasks.delete(taskId)
      executions.delete(taskId)
    },

    async getExecutions(taskId: string, limit = 100): Promise<CronExecutionRecord[]> {
      const execs = executions.get(taskId) || []
      return execs.slice(0, limit)
    },

    async saveExecution(execution: CronExecutionRecord): Promise<void> {
      const cached = executions.get(execution.taskId) || []
      cached.unshift(execution)
      executions.set(execution.taskId, cached)
    },

    async clearExecutions(taskId: string): Promise<void> {
      executions.delete(taskId)
    },

    async clear(): Promise<void> {
      tasks.clear()
      executions.clear()
    }
  }
}
