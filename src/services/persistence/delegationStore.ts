/**
 * DelegationStore - Delegation State Persistence
 * 
 * Persists delegation state for multi-agent authorization.
 * Supports delegator/delegate lookup and permission scoping.
 */

import type { DelegationStore, DelegationState, DelegationStatus } from './types'
import { createIndexedDBFileStore } from './fileStore'

const DELEGATION_DB = 'harness-delegations'

// In-memory index for fast lookups
const delegatorIndex = new Map<string, string[]>() // delegatorId -> delegationIds
const delegateIndex = new Map<string, string[]>()  // delegateId -> delegationIds

/**
 * Create a DelegationStore backed by IndexedDB
 */
export function createDelegationStore(): DelegationStore {
  const store = createIndexedDBFileStore(DELEGATION_DB, { extension: '.delegation.json' })

  return {
    async get(delegationId: string): Promise<DelegationState | null> {
      return store.read<DelegationState>(delegationId)
    },

    async getByDelegator(delegatorId: string): Promise<DelegationState[]> {
      const ids = delegatorIndex.get(delegatorId) || []
      const results: DelegationState[] = []
      
      for (const id of ids) {
        const delegation = await this.get(id)
        if (delegation) {
          results.push(delegation)
        }
      }
      
      return results
    },

    async getByDelegate(delegateId: string): Promise<DelegationState[]> {
      const ids = delegateIndex.get(delegateId) || []
      const results: DelegationState[] = []
      
      for (const id of ids) {
        const delegation = await this.get(id)
        if (delegation) {
          results.push(delegation)
        }
      }
      
      return results
    },

    async save(delegation: DelegationState): Promise<void> {
      // Update indexes
      const existingIds = delegatorIndex.get(delegation.delegatorId) || []
      if (!existingIds.includes(delegation.id)) {
        delegatorIndex.set(delegation.delegatorId, [...existingIds, delegation.id])
      }
      
      const existingDelegateIds = delegateIndex.get(delegation.delegateId) || []
      if (!existingDelegateIds.includes(delegation.id)) {
        delegateIndex.set(delegation.delegateId, [...existingDelegateIds, delegation.id])
      }
      
      await store.write(delegation.id, delegation)
    },

    async update(delegationId: string, updates: Partial<DelegationState>): Promise<void> {
      const existing = await this.get(delegationId)
      if (!existing) {
        throw new Error(`Delegation not found: ${delegationId}`)
      }
      
      const updated: DelegationState = {
        ...existing,
        ...updates,
        id: delegationId,
        updatedAt: Date.now()
      }
      
      await this.save(updated)
    },

    async revoke(delegationId: string): Promise<void> {
      const delegation = await this.get(delegationId)
      if (!delegation) return

      await this.update(delegationId, { status: 'revoked' })
    },

    async list(): Promise<DelegationState[]> {
      const ids = await store.list()
      const results: DelegationState[] = []
      
      for (const id of ids) {
        const delegation = await this.get(id)
        if (delegation) {
          results.push(delegation)
        }
      }
      
      return results
    },

    async clear(): Promise<void> {
      await store.clear()
      delegatorIndex.clear()
      delegateIndex.clear()
    }
  }
}

/**
 * Create an in-memory only DelegationStore (for testing)
 */
export function createMemoryDelegationStore(): DelegationStore {
  const delegations = new Map<string, DelegationState>()

  return {
    async get(delegationId: string): Promise<DelegationState | null> {
      return delegations.get(delegationId) || null
    },

    async getByDelegator(delegatorId: string): Promise<DelegationState[]> {
      return Array.from(delegations.values()).filter(d => d.delegatorId === delegatorId)
    },

    async getByDelegate(delegateId: string): Promise<DelegationState[]> {
      return Array.from(delegations.values()).filter(d => d.delegateId === delegateId)
    },

    async save(delegation: DelegationState): Promise<void> {
      delegations.set(delegation.id, delegation)
    },

    async update(delegationId: string, updates: Partial<DelegationState>): Promise<void> {
      const existing = delegations.get(delegationId)
      if (!existing) {
        throw new Error(`Delegation not found: ${delegationId}`)
      }
      const updated: DelegationState = { ...existing, ...updates, id: delegationId, updatedAt: Date.now() }
      delegations.set(delegationId, updated)
    },

    async revoke(delegationId: string): Promise<void> {
      const existing = delegations.get(delegationId)
      if (!existing) return
      delegations.set(delegationId, { ...existing, status: 'revoked', updatedAt: Date.now() })
    },

    async list(): Promise<DelegationState[]> {
      return Array.from(delegations.values())
    },

    async clear(): Promise<void> {
      delegations.clear()
    }
  }
}

/**
 * Check if a delegation is valid (not expired and not revoked)
 */
export function isDelegationValid(delegation: DelegationState): boolean {
  if (delegation.status === 'revoked' || delegation.status === 'failed') {
    return false
  }
  
  if (delegation.expiresAt && delegation.expiresAt < Date.now()) {
    return false
  }
  
  return true
}

/**
 * Filter delegations by status
 */
export function filterByStatus(
  delegations: DelegationState[], 
  status: DelegationStatus
): DelegationState[] {
  return delegations.filter(d => d.status === status)
}
