/**
 * IndexedDB Storage Abstraction for TrajectoryService
 * Provides simple Promise-based API for IndexedDB operations
 */

export interface IndexedDBStorage {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  getAll<T>(prefix?: string): Promise<T[]>
}

interface StoredRecord<T> {
  key: string
  value: T
}

export function createIndexedDBStorage(name: string, storeName: string): IndexedDBStorage {
  let db: IDBDatabase | null = null
  let dbInitPromise: Promise<IDBDatabase> | null = null

  async function getDB(): Promise<IDBDatabase> {
    if (db) return db
    if (dbInitPromise) return dbInitPromise

    dbInitPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1)

      request.onerror = () => {
        console.error('[IndexedDBStorage] Failed to open database:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        db = request.result
        resolve(db)
      }

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: 'key' })
        }
      }
    })

    return dbInitPromise
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const database = await getDB()
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readonly')
          const store = tx.objectStore(storeName)
          const request = store.get(key)

          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const result = request.result as StoredRecord<T> | undefined
            resolve(result?.value ?? null)
          }
        })
      } catch (error) {
        console.error('[IndexedDBStorage] get error:', error)
        return null
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      try {
        const database = await getDB()
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          const request = store.put({ key, value })

          request.onerror = () => reject(request.error)
          tx.oncomplete = () => resolve()
        })
      } catch (error) {
        console.error('[IndexedDBStorage] set error:', error)
      }
    },

    async delete(key: string): Promise<void> {
      try {
        const database = await getDB()
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          const request = store.delete(key)

          request.onerror = () => reject(request.error)
          tx.oncomplete = () => resolve()
        })
      } catch (error) {
        console.error('[IndexedDBStorage] delete error:', error)
      }
    },

    async clear(): Promise<void> {
      try {
        const database = await getDB()
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          const request = store.clear()

          request.onerror = () => reject(request.error)
          tx.oncomplete = () => resolve()
        })
      } catch (error) {
        console.error('[IndexedDBStorage] clear error:', error)
      }
    },

    async getAll<T>(prefix?: string): Promise<T[]> {
      try {
        const database = await getDB()
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readonly')
          const store = tx.objectStore(storeName)
          const request = store.getAll()

          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const results = request.result as StoredRecord<T>[]
            if (prefix) {
              resolve(results.filter(r => r.key.startsWith(prefix)).map(r => r.value))
            } else {
              resolve(results.map(r => r.value))
            }
          }
        })
      } catch (error) {
        console.error('[IndexedDBStorage] getAll error:', error)
        return []
      }
    }
  }
}