import type { StorageTier, StorageStats } from '../../types'

/**
 * Storage backend interface - pluggable storage abstraction
 * Inspired by hermes-agent's pluggable memory backend
 */
export interface StorageBackend {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
  has(key: string): Promise<boolean>
}

/**
 * Create a localStorage-backed storage
 * Tier: hot - for frequently accessed, small data
 */
export function createLocalStorageBackend(prefix = 'harness:'): StorageBackend {
  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const raw = localStorage.getItem(prefix + key)
        if (raw === null) return null
        return JSON.parse(raw) as T
      } catch {
        return null
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      localStorage.setItem(prefix + key, JSON.stringify(value))
    },

    async remove(key: string): Promise<void> {
      localStorage.removeItem(prefix + key)
    },

    async clear(): Promise<void> {
      // Only clear keys with our prefix
      const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix))
      keys.forEach(k => localStorage.removeItem(k))
    },

    async has(key: string): Promise<boolean> {
      return localStorage.getItem(prefix + key) !== null
    }
  }
}

/**
 * Create an IndexedDB-backed storage
 * Tier: warm - for larger data like verified patterns
 */
export function createIndexedDBBackend(
  dbName = 'harness-memory',
  storeName = 'memory',
  prefix = 'mem:'
): StorageBackend {
  let db: IDBDatabase | null = null

  async function getDB(): Promise<IDBDatabase> {
    if (db) return db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        db = request.result
        resolve(db)
      }

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName)
        }
      }
    })
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const database = await getDB()
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readonly')
          const store = tx.objectStore(storeName)
          const request = store.get(prefix + key)

          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            resolve(request.result ?? null)
          }
        })
      } catch {
        return null
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      const database = await getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const request = store.put(value, prefix + key)

        request.onerror = () => reject(request.error)
        tx.oncomplete = () => resolve()
      })
    },

    async remove(key: string): Promise<void> {
      const database = await getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const request = store.delete(prefix + key)

        request.onerror = () => reject(request.error)
        tx.oncomplete = () => resolve()
      })
    },

    async clear(): Promise<void> {
      const database = await getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const request = store.clear()

        request.onerror = () => reject(request.error)
        tx.oncomplete = () => resolve()
      })
    },

    async has(key: string): Promise<boolean> {
      const result = await this.get(key)
      return result !== null
    }
  }
}

/**
 * Create an electron-store-backed storage
 * Tier: cold - for config, secrets, and critical settings
 */
export function createElectronStoreBackend(): StorageBackend {
  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const electronAPI = (window as any).electronAPI
        if (!electronAPI?.config) return null
        const result = await electronAPI.config.get(key)
        return result as T ?? null
      } catch {
        return null
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      const electronAPI = (window as any).electronAPI
      if (electronAPI?.config) {
        await electronAPI.config.set(key, value)
      }
    },

    async remove(key: string): Promise<void> {
      // Electron store doesn't have direct remove, set to undefined
      await this.set(key, undefined)
    },

    async clear(): Promise<void> {
      // Dangerous - don't implement without explicit whitelisting
      console.warn('ElectronStoreBackend.clear() is not implemented for safety')
    },

    async has(key: string): Promise<boolean> {
      const result = await this.get(key)
      return result !== null
    }
  }
}

/**
 * Get storage stats for monitoring
 */
export async function getStorageStats(backend: StorageBackend, tier: StorageTier): Promise<StorageStats> {
  // This is a simplified implementation
  // Real implementation would track sizes more precisely
  return {
    tier,
    keyCount: 0, // Would need backend-specific implementation
    totalSizeBytes: 0
  }
}
