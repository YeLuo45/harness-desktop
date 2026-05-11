/**
 * FileStore - Atomic File Storage
 * 
 * Provides atomic write semantics for JSON file storage using either
 * localStorage or IndexedDB as the underlying backend.
 * 
 * Atomic write pattern:
 * 1. Write data to temp key with "_tmp" suffix
 * 2. On success, delete old data
 * 3. Rename temp to final key
 * 
 * This ensures readers never see partial/corrupt data.
 */

import type { FileStore, FileStoreOptions } from './types'

const DEFAULT_OPTIONS: Required<FileStoreOptions> = {
  extension: '.json',
  basePath: '',
  atomic: true
}

const TMP_SUFFIX = '_tmp'
const ATOMIC_WRITE_DELAY_MS = 10

/**
 * Create a FileStore instance using localStorage
 */
export function createLocalStorageFileStore(options: FileStoreOptions = {}): FileStore {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const prefix = opts.basePath ? `${opts.basePath}:` : 'filestore:'

  function makeKey(key: string): string {
    const normalized = key.endsWith(opts.extension) ? key : key + opts.extension
    return `${prefix}${normalized}`
  }

  function makeTmpKey(key: string): string {
    return makeKey(key) + TMP_SUFFIX
  }

  return {
    async read<T>(key: string): Promise<T | null> {
      try {
        const raw = localStorage.getItem(makeKey(key))
        if (raw === null) return null
        return JSON.parse(raw) as T
      } catch {
        return null
      }
    },

    async write<T>(key: string, data: T): Promise<void> {
      const finalKey = makeKey(key)
      const tmpKey = makeTmpKey(key)
      const serialized = JSON.stringify(data)

      if (opts.atomic) {
        // Atomic write: write to tmp first
        localStorage.setItem(tmpKey, serialized)
        
        // Small delay to ensure write completes before commit
        await new Promise(resolve => setTimeout(resolve, ATOMIC_WRITE_DELAY_MS))
        
        // Commit: delete old and rename tmp to final
        localStorage.removeItem(finalKey)
        const existing = localStorage.getItem(tmpKey)
        if (existing !== null) {
          localStorage.setItem(finalKey, existing)
          localStorage.removeItem(tmpKey)
        }
      } else {
        // Direct write
        localStorage.setItem(finalKey, serialized)
      }
    },

    async has(key: string): Promise<boolean> {
      return localStorage.getItem(makeKey(key)) !== null
    },

    async delete(key: string): Promise<void> {
      localStorage.removeItem(makeKey(key))
    },

    async list(prefix?: string): Promise<string[]> {
      const searchPrefix = prefix 
        ? `${prefix}${opts.extension}`
        : opts.extension
      
      return Object.keys(localStorage)
        .filter(k => k.startsWith(prefix || ''))
        .filter(k => k.endsWith(searchPrefix) && !k.endsWith(TMP_SUFFIX))
        .map(k => {
          const withoutPrefix = k.replace(prefix || '', '')
          return withoutPrefix.replace(opts.extension, '')
        })
    },

    async clear(): Promise<void> {
      const keys = Object.keys(localStorage).filter(k => 
        k.startsWith(prefix) && !k.endsWith(TMP_SUFFIX)
      )
      keys.forEach(k => localStorage.removeItem(k))
    }
  }
}

/**
 * Create a FileStore instance using IndexedDB (better for larger data)
 */
export function createIndexedDBFileStore(
  dbName = 'harness-filestore',
  options: FileStoreOptions = {}
): FileStore {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const storeName = 'files'
  let db: IDBDatabase | null = null
  let dbInitPromise: Promise<IDBDatabase> | null = null

  async function getDB(): Promise<IDBDatabase> {
    if (db) return db
    if (dbInitPromise) return dbInitPromise

    dbInitPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1)

      request.onerror = () => reject(request.error)
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

  function makeKey(key: string): string {
    const normalized = key.endsWith(opts.extension) ? key : key + opts.extension
    return normalized
  }

  return {
    async read<T>(key: string): Promise<T | null> {
      try {
        const database = await getDB()
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readonly')
          const store = tx.objectStore(storeName)
          const request = store.get(makeKey(key))

          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const result = request.result
            resolve(result?.value ?? null)
          }
        })
      } catch {
        return null
      }
    },

    async write<T>(key: string, data: T): Promise<void> {
      const database = await getDB()
      const finalKey = makeKey(key)

      if (opts.atomic) {
        // Atomic write using temp key pattern
        const tmpKey = finalKey + TMP_SUFFIX
        
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          store.put({ key: tmpKey, value: data })
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })

        // Small delay for write to complete
        await new Promise(resolve => setTimeout(resolve, ATOMIC_WRITE_DELAY_MS))

        // Commit: delete old and rename
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          store.delete(finalKey)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })

        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          const getRequest = store.get(tmpKey)
          getRequest.onsuccess = () => {
            const tmpRecord = getRequest.result
            if (tmpRecord) {
              store.put({ key: finalKey, value: tmpRecord.value })
              store.delete(tmpKey)
            }
          }
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      } else {
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          store.put({ key: finalKey, value: data })
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      }
    },

    async has(key: string): Promise<boolean> {
      const result = await this.read(key)
      return result !== null
    },

    async delete(key: string): Promise<void> {
      const database = await getDB()
      return new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const request = store.delete(makeKey(key))
        request.onerror = () => reject(request.error)
        tx.oncomplete = () => resolve()
      })
    },

    async list(prefix?: string): Promise<string[]> {
      try {
        const database = await getDB()
        return new Promise((resolve, reject) => {
          const tx = database.transaction(storeName, 'readonly')
          const store = tx.objectStore(storeName)
          const request = store.getAll()

          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const ext = opts.extension
            const results = request.result
              .filter((r: { key: string }) => 
                !r.key.endsWith(TMP_SUFFIX) &&
                r.key.endsWith(ext)
              )
              .map((r: { key: string }) => 
                r.key.replace(ext, '')
              )
            
            if (prefix) {
              resolve(results.filter((k: string) => k.startsWith(prefix)))
            } else {
              resolve(results)
            }
          }
        })
      } catch {
        return []
      }
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
    }
  }
}
