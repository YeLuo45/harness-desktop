import type { MemoryPointer, VerificationPattern, UserPreferences } from '../types'
import {
  createLocalStorageBackend,
  createIndexedDBBackend,
  createElectronStoreBackend,
  type StorageBackend
} from './storage'

/**
 * LongTermMemoryService - Pluggable memory backend for harness-desktop
 * Inspired by hermes-agent's pluggable memory backend design
 *
 * Architecture:
 * - hot (localStorage): user preferences, UI state
 * - warm (IndexedDB): memory pointers, verification patterns
 * - cold (electron-store): config, API keys
 */
export class LongTermMemoryService {
  private hot: StorageBackend   // localStorage - fast, small data
  private warm: StorageBackend  // IndexedDB - larger data, patterns
  private cold: StorageBackend  // electron-store - config, secrets

  constructor() {
    this.hot = createLocalStorageBackend('harness:')
    this.warm = createIndexedDBBackend('harness-memory', 'memory', 'mem:')
    this.cold = createElectronStoreBackend()
  }

  // ============================================
  // Memory Pointer Operations
  // ============================================

  /**
   * Save a memory pointer to warm storage
   */
  async saveMemoryPointer(pointer: MemoryPointer): Promise<void> {
    await this.warm.set(`pointer:${pointer.id}`, pointer)
  }

  /**
   * Get a memory pointer by ID
   */
  async getMemoryPointer(id: string): Promise<MemoryPointer | null> {
    return this.warm.get<MemoryPointer>(`pointer:${id}`)
  }

  /**
   * Get all memory pointers
   */
  async getAllMemoryPointers(): Promise<MemoryPointer[]> {
    // Note: IndexedDB doesn't support listing all keys efficiently
    // This requires a separate index or full scan
    // For now, return empty array - will be enhanced in Phase 2
    return []
  }

  /**
   * Delete a memory pointer
   */
  async deleteMemoryPointer(id: string): Promise<void> {
    await this.warm.remove(`pointer:${id}`)
  }

  // ============================================
  // Verification Pattern Operations
  // ============================================

  /**
   * Save or update a verification pattern
   */
  async saveVerificationPattern(pattern: VerificationPattern): Promise<void> {
    const key = `pattern:${pattern.toolName}:${this.hashPattern(pattern.pattern)}`
    await this.warm.set(key, pattern)
  }

  /**
   * Get verification patterns for a tool
   */
  async getVerificationPatterns(toolName: string): Promise<VerificationPattern[]> {
    // Would need index scan - simplified for now
    return []
  }

  /**
   * Increment pattern success count
   */
  async incrementPatternSuccess(id: string): Promise<void> {
    const pattern = await this.warm.get<VerificationPattern>(`pattern:${id}`)
    if (pattern) {
      pattern.successCount++
      pattern.lastUsed = Date.now()
      await this.warm.set(`pattern:${id}`, pattern)
    }
  }

  // ============================================
  // User Preferences Operations
  // ============================================

  /**
   * Save user preferences to hot storage
   */
  async saveUserPreferences(prefs: UserPreferences): Promise<void> {
    await this.hot.set('user_prefs', prefs)
  }

  /**
   * Load user preferences
   */
  async loadUserPreferences(): Promise<UserPreferences | null> {
    return this.hot.get<UserPreferences>('user_prefs')
  }

  // ============================================
  // Context Snapshot Operations
  // ============================================

  /**
   * Save a full context snapshot for session restore
   */
  async saveContextSnapshot(pointers: MemoryPointer[]): Promise<void> {
    await this.warm.set('context:snapshots:latest', {
      pointers,
      timestamp: Date.now()
    })
  }

  /**
   * Restore context from latest snapshot
   */
  async restoreContextSnapshot(): Promise<MemoryPointer[]> {
    interface Snapshot {
      pointers: MemoryPointer[]
      timestamp: number
    }

    const snapshot = await this.warm.get<Snapshot>('context:snapshots:latest')
    return snapshot?.pointers ?? []
  }

  // ============================================
  // Maintenance Operations
  // ============================================

  /**
   * Clear all warm storage data
   */
  async clearWarmStorage(): Promise<void> {
    await this.warm.clear()
  }

  /**
   * Clear all hot storage data
   */
  async clearHotStorage(): Promise<void> {
    await this.hot.clear()
  }

  // ============================================
  // Private Helpers
  // ============================================

  private hashPattern(pattern: string): string {
    // Simple hash for pattern key - in production use proper hashing
    return pattern.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32)
  }
}

// Singleton instance
let ltmInstance: LongTermMemoryService | null = null

export function getLongTermMemoryService(): LongTermMemoryService {
  if (!ltmInstance) {
    ltmInstance = new LongTermMemoryService()
  }
  return ltmInstance
}
