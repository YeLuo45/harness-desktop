/**
 * Persistence Module
 * 
 * Unified export for all persistence-related stores and types.
 */

export * from './types'
export { createLocalStorageFileStore, createIndexedDBFileStore } from './fileStore'
export { 
  createDelegationStore, 
  createMemoryDelegationStore, 
  isDelegationValid, 
  filterByStatus 
} from './delegationStore'
export { createCronStore, createMemoryCronStore } from './cronStore'

import type { DelegationStore, CronStore } from './types'
import { createDelegationStore } from './delegationStore'
import { createCronStore } from './cronStore'

// Default singleton instances (lazy-initialized)
let defaultDelegationStore: DelegationStore | null = null
let defaultCronStore: CronStore | null = null

/**
 * Get the default DelegationStore instance
 */
export function getDelegationStore(): DelegationStore {
  if (!defaultDelegationStore) {
    defaultDelegationStore = createDelegationStore()
  }
  return defaultDelegationStore
}

/**
 * Get the default CronStore instance
 */
export function getCronStore(): CronStore {
  if (!defaultCronStore) {
    defaultCronStore = createCronStore()
  }
  return defaultCronStore
}
