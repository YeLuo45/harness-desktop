/**
 * Role Store Service
 * 
 * Persistent storage for role configurations using electron-store.
 * Provides save/load functionality for role configs.
 */

import { v4 as uuidv4 } from 'uuid'
import type { RoleConfig, RoleType } from '../services/roleManager'

// Since we can't import electron-store directly in renderer,
// we use a simple interface that maps to electronAPI.config
interface ElectronConfigStore {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<boolean>
  getAll: () => Promise<Record<string, unknown>>
}

const ROLE_STORE_KEY = 'roleConfig'

export interface StoredRoleConfig {
  id: string
  name: string
  type: RoleType
  enabled: boolean
  config: RoleConfig
  createdAt: number
  updatedAt: number
}

export interface RoleStoreData {
  roles: StoredRoleConfig[]
  defaultRolesInitialized: boolean
  version: number
}

const DEFAULT_ROLE_CONFIGS: Record<RoleType, RoleConfig> = {
  planner: {
    name: 'Planner',
    type: 'planner',
    maxConcurrentTasks: 2,
    timeout: 60000,
    retryOnFailure: true,
    maxRetries: 3,
    capabilities: ['plan', 'analyze', 'decompose', 'delegate']
  },
  coder: {
    name: 'Coder',
    type: 'coder',
    maxConcurrentTasks: 4,
    timeout: 45000,
    retryOnFailure: true,
    maxRetries: 3,
    capabilities: ['write', 'edit', 'delete', 'read', 'execute']
  },
  reviewer: {
    name: 'Reviewer',
    type: 'reviewer',
    maxConcurrentTasks: 3,
    timeout: 30000,
    retryOnFailure: true,
    maxRetries: 2,
    capabilities: ['review', 'verify', 'approve', 'reject', 'suggest']
  },
  executor: {
    name: 'Executor',
    type: 'executor',
    maxConcurrentTasks: 4,
    timeout: 30000,
    retryOnFailure: true,
    maxRetries: 3,
    capabilities: ['execute', 'run', 'build', 'test', 'deploy']
  }
}

export class RoleStore {
  private store: ElectronConfigStore | null = null
  private cache: RoleStoreData | null = null

  /**
   * Initialize with electron store
   */
  initialize(store: ElectronConfigStore): void {
    this.store = store
  }

  /**
   * Get electron API config store
   */
  private getStore(): ElectronConfigStore {
    if (!this.store) {
      // Try to get from window.electronAPI
      const electronAPI = (window as unknown as { electronAPI?: { config: ElectronConfigStore } }).electronAPI
      if (!electronAPI?.config) {
        throw new Error('RoleStore not initialized and electronAPI not available')
      }
      this.store = electronAPI.config
    }
    return this.store
  }

  /**
   * Load all role configurations
   */
  async loadRoles(): Promise<StoredRoleConfig[]> {
    try {
      const stored = await this.getStore().get(ROLE_STORE_KEY)
      if (stored && typeof stored === 'object') {
        const data = stored as RoleStoreData
        this.cache = data
        return data.roles
      }
    } catch (error) {
      console.warn('[RoleStore] Failed to load roles:', error)
    }
    
    // Return empty if not found
    return []
  }

  /**
   * Save all role configurations
   */
  async saveRoles(roles: StoredRoleConfig[]): Promise<void> {
    try {
      const data: RoleStoreData = {
        roles,
        defaultRolesInitialized: true,
        version: 1
      }
      await this.getStore().set(ROLE_STORE_KEY, data)
      this.cache = data
    } catch (error) {
      console.error('[RoleStore] Failed to save roles:', error)
      throw error
    }
  }

  /**
   * Get a single role config
   */
  async getRole(roleId: string): Promise<StoredRoleConfig | null> {
    const roles = await this.loadRoles()
    return roles.find(r => r.id === roleId) || null
  }

  /**
   * Save a single role config
   */
  async saveRole(role: StoredRoleConfig): Promise<void> {
    const roles = await this.loadRoles()
    const index = roles.findIndex(r => r.id === role.id)
    
    if (index >= 0) {
      roles[index] = role
    } else {
      roles.push(role)
    }
    
    await this.saveRoles(roles)
  }

  /**
   * Delete a role
   */
  async deleteRole(roleId: string): Promise<boolean> {
    const roles = await this.loadRoles()
    const initialLength = roles.length
    const filtered = roles.filter(r => r.id !== roleId)
    
    if (filtered.length < initialLength) {
      await this.saveRoles(filtered)
      return true
    }
    return false
  }

  /**
   * Initialize default roles if not already initialized
   */
  async initializeDefaultRoles(): Promise<StoredRoleConfig[]> {
    const existing = await this.loadRoles()
    
    if (existing.length > 0) {
      return existing
    }

    // Create default roles
    const defaultRoles: StoredRoleConfig[] = Object.entries(DEFAULT_ROLE_CONFIGS).map(
      ([type, config]) => ({
        id: uuidv4(),
        name: config.name,
        type: type as RoleType,
        enabled: true,
        config: {
          ...config,
          id: undefined // Will be set on creation
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    )

    await this.saveRoles(defaultRoles)
    return defaultRoles
  }

  /**
   * Update role enabled status
   */
  async setRoleEnabled(roleId: string, enabled: boolean): Promise<boolean> {
    const roles = await this.loadRoles()
    const role = roles.find(r => r.id === roleId)
    
    if (!role) return false
    
    role.enabled = enabled
    role.updatedAt = Date.now()
    
    await this.saveRoles(roles)
    return true
  }

  /**
   * Update role configuration
   */
  async updateRoleConfig(
    roleId: string, 
    updates: Partial<RoleConfig>
  ): Promise<boolean> {
    const roles = await this.loadRoles()
    const role = roles.find(r => r.id === roleId)
    
    if (!role) return false
    
    role.config = { ...role.config, ...updates }
    role.updatedAt = Date.now()
    
    await this.saveRoles(roles)
    return true
  }

  /**
   * Get enabled roles
   */
  async getEnabledRoles(): Promise<StoredRoleConfig[]> {
    const roles = await this.loadRoles()
    return roles.filter(r => r.enabled)
  }

  /**
   * Get role config by type
   */
  async getRoleByType(type: RoleType): Promise<StoredRoleConfig | null> {
    const roles = await this.loadRoles()
    return roles.find(r => r.type === type && r.enabled) || null
  }

  /**
   * Check if store has any roles
   */
  async hasRoles(): Promise<boolean> {
    const roles = await this.loadRoles()
    return roles.length > 0
  }

  /**
   * Reset to default roles (deletes all custom roles)
   */
  async resetToDefaults(): Promise<StoredRoleConfig[]> {
    const defaultRoles: StoredRoleConfig[] = Object.entries(DEFAULT_ROLE_CONFIGS).map(
      ([type, config]) => ({
        id: uuidv4(),
        name: config.name,
        type: type as RoleType,
        enabled: true,
        config: {
          ...config,
          id: undefined
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    )

    await this.saveRoles(defaultRoles)
    return defaultRoles
  }

  /**
   * Export roles as JSON
   */
  async exportRoles(): Promise<string> {
    const roles = await this.loadRoles()
    return JSON.stringify(roles, null, 2)
  }

  /**
   * Import roles from JSON
   */
  async importRoles(json: string): Promise<StoredRoleConfig[]> {
    try {
      const imported = JSON.parse(json) as StoredRoleConfig[]
      
      // Validate structure
      if (!Array.isArray(imported)) {
        throw new Error('Invalid role data: expected array')
      }

      // Assign new IDs to avoid conflicts
      const roles = imported.map(r => ({
        ...r,
        id: uuidv4(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      }))

      await this.saveRoles(roles)
      return roles
    } catch (error) {
      console.error('[RoleStore] Import failed:', error)
      throw new Error(`Failed to import roles: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Singleton instance
let roleStoreInstance: RoleStore | null = null

export function getRoleStore(): RoleStore {
  if (!roleStoreInstance) {
    roleStoreInstance = new RoleStore()
  }
  return roleStoreInstance
}

export function initRoleStore(store?: ElectronConfigStore): RoleStore {
  roleStoreInstance = new RoleStore()
  if (store) {
    roleStoreInstance.initialize(store)
  }
  return roleStoreInstance
}