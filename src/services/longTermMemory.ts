import type { MemoryPointer, VerificationPattern, UserPreferences } from '../types'
import {
  createLocalStorageBackend,
  createIndexedDBBackend,
  createElectronStoreBackend,
  type StorageBackend
} from './storage'

/**
 * Snapshot information
 */
export interface SnapshotInfo {
  id: string
  timestamp: number
  pointerCount: number
  tokenCount: number
  description?: string
}

/**
 * Delta change record for incremental sync
 */
export interface DeltaChange {
  pointerId: string
  action: 'add' | 'update' | 'delete'
  timestamp: number
  pointer?: MemoryPointer
}

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

  // Snapshot tracking
  private snapshots: Map<string, SnapshotInfo> = new Map()
  private latestSnapshotId: string | null = null

  // Delta tracking
  private pendingDeltas: DeltaChange[] = []
  private lastSyncTimestamp: number = 0

  constructor() {
    this.hot = createLocalStorageBackend('harness:')
    this.warm = createIndexedDBBackend('harness-memory', 'memory', 'mem:')
    this.cold = createElectronStoreBackend()
  }

  // Export these for use by SessionManager
  static saveSessionAtomic = async (path: string, data: unknown) => {
    const { saveSessionAtomic: fn } = await import('./memory/atomicSession')
    return fn(path, data)
  }

  static loadSession = async (path: string) => {
    const { loadSession: fn } = await import('./memory/atomicSession')
    return fn(path)
  }

  // ============================================
  // Memory Pointer Operations
  // ============================================

  /**
   * Save a memory pointer to warm storage
   * @param pointer The pointer to save
   * @param isDelta If true, only saves the delta change (for incremental sync)
   */
  async saveMemoryPointer(pointer: MemoryPointer, isDelta = false): Promise<void> {
    if (isDelta) {
      // Record delta instead of full save
      const delta: DeltaChange = {
        pointerId: pointer.id,
        action: 'add',
        timestamp: Date.now(),
        pointer
      }
      this.pendingDeltas.push(delta)
    }
    await this.warm.set(`pointer:${pointer.id}`, pointer)
  }

  /**
   * Update an existing memory pointer
   * @param isDelta If true, records delta change for incremental sync
   */
  async updateMemoryPointer(pointer: MemoryPointer, isDelta = false): Promise<void> {
    if (isDelta) {
      const delta: DeltaChange = {
        pointerId: pointer.id,
        action: 'update',
        timestamp: Date.now(),
        pointer
      }
      this.pendingDeltas.push(delta)
    }
    await this.warm.set(`pointer:${pointer.id}`, pointer)
  }

  /**
   * Delete a memory pointer
   * @param isDelta If true, records delta change for incremental sync
   */
  async deleteMemoryPointer(id: string, isDelta = false): Promise<void> {
    if (isDelta) {
      const delta: DeltaChange = {
        pointerId: id,
        action: 'delete',
        timestamp: Date.now()
      }
      this.pendingDeltas.push(delta)
    }
    await this.warm.remove(`pointer:${id}`)
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

  // ============================================
  // Delta Sync Operations
  // ============================================

  /**
   * Get pending delta changes since last sync
   */
  getPendingDeltas(): DeltaChange[] {
    return [...this.pendingDeltas]
  }

  /**
   * Get delta changes since a specific timestamp
   */
  getDeltasSince(timestamp: number): DeltaChange[] {
    return this.pendingDeltas.filter(d => d.timestamp > timestamp)
  }

  /**
   * Clear pending deltas after successful sync
   */
  clearPendingDeltas(): void {
    this.pendingDeltas = []
    this.lastSyncTimestamp = Date.now()
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncTimestamp(): number {
    return this.lastSyncTimestamp
  }

  // ============================================
  // Snapshot Management
  // ============================================

  /**
   * Create a snapshot of current memory state
   * @returns Snapshot ID
   */
  async createSnapshot(pointers: MemoryPointer[], description?: string): Promise<string> {
    const snapshotId = `snapshot-${Date.now()}`
    const tokenCount = pointers.reduce((sum, p) => sum + Math.ceil(p.fullContent.length / 4), 0)

    const snapshotInfo: SnapshotInfo = {
      id: snapshotId,
      timestamp: Date.now(),
      pointerCount: pointers.length,
      tokenCount,
      description
    }

    // Store snapshot data
    await this.warm.set(`snapshot:${snapshotId}`, {
      info: snapshotInfo,
      pointers
    })

    // Update snapshots index
    this.snapshots.set(snapshotId, snapshotInfo)
    this.latestSnapshotId = snapshotId

    // Persist snapshots list
    await this.saveSnapshotsIndex()

    return snapshotId
  }

  /**
   * Restore memory from a snapshot
   */
  async restoreSnapshot(snapshotId: string): Promise<MemoryPointer[]> {
    const data = await this.warm.get<{ info: SnapshotInfo; pointers: MemoryPointer[] }>(`snapshot:${snapshotId}`)
    return data?.pointers ?? []
  }

  /**
   * List all available snapshots
   */
  async listSnapshots(): Promise<SnapshotInfo[]> {
    // Try to load from storage first
    const stored = await this.warm.get<SnapshotInfo[]>('snapshots:index')
    if (stored) {
      for (const info of stored) {
        this.snapshots.set(info.id, info)
      }
    }

    return Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.warm.remove(`snapshot:${snapshotId}`)
    this.snapshots.delete(snapshotId)

    if (this.latestSnapshotId === snapshotId) {
      this.latestSnapshotId = null
    }

    await this.saveSnapshotsIndex()
  }

  /**
   * Get the latest snapshot ID
   */
  getLatestSnapshotId(): string | null {
    return this.latestSnapshotId
  }

  private async saveSnapshotsIndex(): Promise<void> {
    const index = Array.from(this.snapshots.values())
    await this.warm.set('snapshots:index', index)
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
    this.snapshots.clear()
    this.latestSnapshotId = null
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

export function initLongTermMemoryService(): LongTermMemoryService {
  ltmInstance = new LongTermMemoryService()
  return ltmInstance
}
