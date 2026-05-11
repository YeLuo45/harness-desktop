/**
 * P9: Task Scheduling - CronStore
 * 
 * Persistent storage for scheduled tasks, executions, and dependencies.
 * Uses IndexedDB for reliable cross-session storage.
 */

import type { ScheduledTask, TaskExecution, TaskDependency } from './types'

const TASKS_KEY = 'cron_tasks'
const EXECUTIONS_KEY = 'cron_executions'
const DEPENDENCIES_KEY = 'cron_dependencies'
const STATE_KEY = 'cron_scheduler_state'

export interface SchedulerState {
  lastInitialized: number
  version: number
}

export class CronStore {
  private db: IDBDatabase | null = null
  private dbName: string
  private storeName: string

  constructor(dbName = 'harness-scheduler', storeName = 'cron-data') {
    this.dbName = dbName
    this.storeName = storeName
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result
        
        // Tasks store
        if (!database.objectStoreNames.contains(TASKS_KEY)) {
          database.createObjectStore(TASKS_KEY, { keyPath: 'id' })
        }
        
        // Executions store (keyed by taskId, stores array of executions)
        if (!database.objectStoreNames.contains(EXECUTIONS_KEY)) {
          database.createObjectStore(EXECUTIONS_KEY, { keyPath: 'taskId' })
        }
        
        // Dependencies store
        if (!database.objectStoreNames.contains(DEPENDENCIES_KEY)) {
          database.createObjectStore(DEPENDENCIES_KEY, { keyPath: 'taskId' })
        }
        
        // Scheduler state store
        if (!database.objectStoreNames.contains(STATE_KEY)) {
          database.createObjectStore(STATE_KEY, { keyPath: 'key' })
        }
      }
    })
  }

  // ========== Tasks ==========

  async saveTask(task: ScheduledTask): Promise<void> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(TASKS_KEY, 'readwrite')
        const store = tx.objectStore(TASKS_KEY)
        const request = store.put(task)
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => resolve()
      })
    } catch (error) {
      console.error('[CronStore] Failed to save task:', error)
    }
  }

  async saveTasks(tasks: ScheduledTask[]): Promise<void> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(TASKS_KEY, 'readwrite')
        const store = tx.objectStore(TASKS_KEY)
        
        // Clear existing and add all
        store.clear()
        
        for (const task of tasks) {
          store.put(task)
        }
        
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch (error) {
      console.error('[CronStore] Failed to save tasks:', error)
    }
  }

  async getTask(id: string): Promise<ScheduledTask | undefined> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(TASKS_KEY, 'readonly')
        const store = tx.objectStore(TASKS_KEY)
        const request = store.get(id)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
      })
    } catch (error) {
      console.error('[CronStore] Failed to get task:', error)
      return undefined
    }
  }

  async getAllTasks(): Promise<ScheduledTask[]> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(TASKS_KEY, 'readonly')
        const store = tx.objectStore(TASKS_KEY)
        const request = store.getAll()
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result || [])
      })
    } catch (error) {
      console.error('[CronStore] Failed to get all tasks:', error)
      return []
    }
  }

  async deleteTask(id: string): Promise<void> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(TASKS_KEY, 'readwrite')
        const store = tx.objectStore(TASKS_KEY)
        const request = store.delete(id)
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => resolve()
      })
    } catch (error) {
      console.error('[CronStore] Failed to delete task:', error)
    }
  }

  // ========== Executions ==========

  async saveExecution(taskId: string, execution: TaskExecution): Promise<void> {
    try {
      const executions = await this.getExecutions(taskId)
      executions.push(execution)
      
      // Keep last 100 executions per task
      if (executions.length > 100) {
        executions.shift()
      }
      
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(EXECUTIONS_KEY, 'readwrite')
        const store = tx.objectStore(EXECUTIONS_KEY)
        const request = store.put({ taskId, executions })
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => resolve()
      })
    } catch (error) {
      console.error('[CronStore] Failed to save execution:', error)
    }
  }

  async getExecutions(taskId: string): Promise<TaskExecution[]> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(EXECUTIONS_KEY, 'readonly')
        const store = tx.objectStore(EXECUTIONS_KEY)
        const request = store.get(taskId)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result?.executions || [])
      })
    } catch (error) {
      console.error('[CronStore] Failed to get executions:', error)
      return []
    }
  }

  async getAllExecutions(): Promise<Map<string, TaskExecution[]>> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(EXECUTIONS_KEY, 'readonly')
        const store = tx.objectStore(EXECUTIONS_KEY)
        const request = store.getAll()
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const result = new Map<string, TaskExecution[]>()
          for (const item of request.result || []) {
            result.set(item.taskId, item.executions)
          }
          resolve(result)
        }
      })
    } catch (error) {
      console.error('[CronStore] Failed to get all executions:', error)
      return new Map()
    }
  }

  async clearExecutions(taskId?: string): Promise<void> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(EXECUTIONS_KEY, 'readwrite')
        const store = tx.objectStore(EXECUTIONS_KEY)
        
        if (taskId) {
          store.delete(taskId)
        } else {
          store.clear()
        }
        
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch (error) {
      console.error('[CronStore] Failed to clear executions:', error)
    }
  }

  // ========== Dependencies ==========

  async saveDependencies(dependencies: Map<string, TaskDependency>): Promise<void> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(DEPENDENCIES_KEY, 'readwrite')
        const store = tx.objectStore(DEPENDENCIES_KEY)
        
        store.clear()
        
        dependencies.forEach((dep) => {
          store.put(dep)
        })
        
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch (error) {
      console.error('[CronStore] Failed to save dependencies:', error)
    }
  }

  async getAllDependencies(): Promise<Map<string, TaskDependency>> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(DEPENDENCIES_KEY, 'readonly')
        const store = tx.objectStore(DEPENDENCIES_KEY)
        const request = store.getAll()
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const result = new Map<string, TaskDependency>()
          for (const dep of request.result || []) {
            result.set(dep.taskId, dep)
          }
          resolve(result)
        }
      })
    } catch (error) {
      console.error('[CronStore] Failed to get dependencies:', error)
      return new Map()
    }
  }

  // ========== Scheduler State ==========

  async saveSchedulerState(state: Partial<SchedulerState>): Promise<void> {
    try {
      const current = await this.getSchedulerState()
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STATE_KEY, 'readwrite')
        const store = tx.objectStore(STATE_KEY)
        const request = store.put({ key: 'state', ...current, ...state })
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => resolve()
      })
    } catch (error) {
      console.error('[CronStore] Failed to save scheduler state:', error)
    }
  }

  async getSchedulerState(): Promise<SchedulerState | null> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STATE_KEY, 'readonly')
        const store = tx.objectStore(STATE_KEY)
        const request = store.get('state')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result || null)
      })
    } catch (error) {
      console.error('[CronStore] Failed to get scheduler state:', error)
      return null
    }
  }

  // ========== Clear All ==========

  async clearAll(): Promise<void> {
    try {
      const database = await this.getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction([TASKS_KEY, EXECUTIONS_KEY, DEPENDENCIES_KEY, STATE_KEY], 'readwrite')
        
        tx.objectStore(TASKS_KEY).clear()
        tx.objectStore(EXECUTIONS_KEY).clear()
        tx.objectStore(DEPENDENCIES_KEY).clear()
        tx.objectStore(STATE_KEY).clear()
        
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch (error) {
      console.error('[CronStore] Failed to clear all:', error)
    }
  }
}

// Singleton instance
export const cronStore = new CronStore()
