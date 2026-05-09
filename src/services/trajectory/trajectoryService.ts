/**
 * TrajectoryService - 轨迹记录与查询服务
 * Inspired by hermes-agent's trajectory system and SQLite/FTS5 design
 * 
 * 核心能力：
 * - 结构化存储对话事件（user/assistant/tool/system）
 * - 多维度查询（session/type/tag/time/keyword）
 * - 跨会话轨迹追溯
 * - 全文搜索
 * - IndexedDB 持久化
 */

import type {
  TrajectoryRecord,
  TrajectoryQuery,
  TrajectoryResult,
  TrajectoryStats,
  TrajectoryEvent,
  TrajectoryType
} from './types'
import { createTrajectoryRecord } from './types'
import { createIndexedDBStorage, type IndexedDBStorage } from '../storage/indexedDBStorage'

// Record stored in IndexedDB
interface StoredTrajectoryRecord extends TrajectoryRecord {
  id: string
}

// TrajectoryStore with IndexedDB persistence and in-memory L1 cache
class TrajectoryStore {
  private db: IndexedDBStorage
  private records: Map<string, TrajectoryRecord> = new Map()  // L1 cache
  private sessionIndex: Map<string, Set<string>> = new Map()
  private typeIndex: Map<TrajectoryType, Set<string>> = new Map()
  private tagIndex: Map<string, Set<string>> = new Map()
  private initialized: boolean = false

  constructor() {
    this.db = createIndexedDBStorage('harness-trajectory', 'trajectory')
  }

  /**
   * Initialize store by loading existing records from IndexedDB
   */
  async init(): Promise<void> {
    if (this.initialized) return
    
    try {
      const allRecords = await this.db.getAll<StoredTrajectoryRecord>('traj_')
      for (const record of allRecords) {
        // Restore to L1 cache
        this.records.set(record.id, record)
        
        // Rebuild session index
        if (!this.sessionIndex.has(record.sessionId)) {
          this.sessionIndex.set(record.sessionId, new Set())
        }
        this.sessionIndex.get(record.sessionId)!.add(record.id)
        
        // Rebuild type index
        if (!this.typeIndex.has(record.type)) {
          this.typeIndex.set(record.type, new Set())
        }
        this.typeIndex.get(record.type)!.add(record.id)
        
        // Rebuild tag index
        for (const tag of record.tags) {
          if (!this.tagIndex.has(tag)) {
            this.tagIndex.set(tag, new Set())
          }
          this.tagIndex.get(tag)!.add(record.id)
        }
      }
      this.initialized = true
    } catch (error) {
      console.error('[TrajectoryStore] Failed to initialize from IndexedDB:', error)
      this.initialized = true
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init()
    }
  }

  async set(record: TrajectoryRecord): Promise<void> {
    await this.ensureInitialized()
    
    // Update L1 cache
    this.records.set(record.id, record)
    
    // Update session index
    if (!this.sessionIndex.has(record.sessionId)) {
      this.sessionIndex.set(record.sessionId, new Set())
    }
    this.sessionIndex.get(record.sessionId)!.add(record.id)
    
    // Update type index
    if (!this.typeIndex.has(record.type)) {
      this.typeIndex.set(record.type, new Set())
    }
    this.typeIndex.get(record.type)!.add(record.id)
    
    // Update tag index
    for (const tag of record.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set())
      }
      this.tagIndex.get(tag)!.add(record.id)
    }
    
    // Persist to IndexedDB
    await this.db.set(record.id, record)
  }

  async get(id: string): Promise<TrajectoryRecord | null> {
    await this.ensureInitialized()
    return this.records.get(id) || null
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized()
    
    const record = this.records.get(id)
    if (!record) return false
    
    // Remove from all indices and cache
    this.records.delete(id)
    
    const sessionIds = this.sessionIndex.get(record.sessionId)
    if (sessionIds) {
      sessionIds.delete(id)
      if (sessionIds.size === 0) {
        this.sessionIndex.delete(record.sessionId)
      }
    }
    
    const typeIds = this.typeIndex.get(record.type)
    if (typeIds) {
      typeIds.delete(id)
      if (typeIds.size === 0) {
        this.typeIndex.delete(record.type)
      }
    }
    
    for (const tag of record.tags) {
      const tagIds = this.tagIndex.get(tag)
      if (tagIds) {
        tagIds.delete(id)
        if (tagIds.size === 0) {
          this.tagIndex.delete(tag)
        }
      }
    }
    
    // Remove from IndexedDB
    await this.db.delete(id)
    
    return true
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureInitialized()
    
    const ids = this.sessionIndex.get(sessionId)
    if (ids) {
      for (const id of ids) {
        await this.delete(id)
      }
    }
  }

  async getSessionRecords(sessionId: string): Promise<TrajectoryRecord[]> {
    await this.ensureInitialized()
    
    const ids = this.sessionIndex.get(sessionId)
    if (!ids) return []
    
    const records: TrajectoryRecord[] = []
    for (const id of ids) {
      const record = this.records.get(id)
      if (record) records.push(record)
    }
    
    return records.sort((a, b) => a.turn - b.turn)
  }

  async getAllIds(): Promise<string[]> {
    await this.ensureInitialized()
    return Array.from(this.records.keys())
  }

  async queryIds(query: TrajectoryQuery): Promise<string[]> {
    await this.ensureInitialized()
    
    let candidateIds: Set<string> | null = null
    
    // Session filter
    if (query.sessionId) {
      const sessionIds = this.sessionIndex.get(query.sessionId)
      if (sessionIds) {
        candidateIds = new Set(sessionIds)
      } else {
        return [] // No records for this session
      }
    }
    
    // Type filter
    if (query.types && query.types.length > 0) {
      const typeSet = new Set<string>()
      for (const type of query.types) {
        const ids = this.typeIndex.get(type)
        if (ids) {
          for (const id of ids) {
            typeSet.add(id)
          }
        }
      }
      if (candidateIds) {
        candidateIds = this.intersect(candidateIds, typeSet)
      } else {
        candidateIds = typeSet
      }
      if (candidateIds.size === 0) return []
    }
    
    // Tag filter
    if (query.tags && query.tags.length > 0) {
      const tagSet = new Set<string>()
      for (const tag of query.tags) {
        const ids = this.tagIndex.get(tag)
        if (ids) {
          for (const id of ids) {
            tagSet.add(id)
          }
        }
      }
      if (candidateIds) {
        candidateIds = this.intersect(candidateIds, tagSet)
      } else {
        candidateIds = tagSet
      }
      if (candidateIds.size === 0) return []
    }
    
    // Default: all records
    if (!candidateIds) {
      candidateIds = new Set(this.records.keys())
    }
    
    // Collect candidates
    const result: string[] = []
    for (const id of candidateIds) {
      const record = this.records.get(id)
      if (!record) continue
      
      // Time range filter
      if (query.timeRange) {
        if (record.timestamp < query.timeRange.start || record.timestamp > query.timeRange.end) {
          continue
        }
      }
      
      // Keyword filter (substring match on content and summary)
      if (query.keyword) {
        const kw = query.keyword.toLowerCase()
        if (!record.content.toLowerCase().includes(kw) && 
            !record.summary.toLowerCase().includes(kw)) {
          continue
        }
      }
      
      result.push(id)
    }
    
    // Sort by timestamp descending (newest first) by default
    result.sort((a, b) => {
      const recA = this.records.get(a)!
      const recB = this.records.get(b)!
      return recB.timestamp - recA.timestamp
    })
    
    return result
  }

  private intersect(a: Set<string>, b: Set<string>): Set<string> {
    const result = new Set<string>()
    for (const id of a) {
      if (b.has(id)) result.add(id)
    }
    return result
  }
}

export class TrajectoryService {
  private store: TrajectoryStore

  constructor() {
    this.store = new TrajectoryStore()
  }

  /**
   * Record a trajectory event
   */
  async record(event: TrajectoryEvent): Promise<TrajectoryRecord> {
    const record = createTrajectoryRecord(event)
    await this.store.set(record)
    return record
  }

  /**
   * Get a single record by ID
   */
  async get(id: string): Promise<TrajectoryRecord | null> {
    return this.store.get(id)
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    return this.store.delete(id)
  }

  /**
   * Query trajectory records with filters
   */
  async query(query: TrajectoryQuery): Promise<TrajectoryResult> {
    const offset = query.offset || 0
    const limit = query.limit || 50
    
    const ids = await this.store.queryIds(query)
    const total = ids.length
    
    const paginatedIds = ids.slice(offset, offset + limit)
    const records: TrajectoryRecord[] = []
    
    for (const id of paginatedIds) {
      const record = await this.store.get(id)
      if (record) records.push(record)
    }
    
    return {
      records,
      total,
      hasMore: offset + limit < total
    }
  }

  /**
   * Get all records for a session in chronological order
   */
  async getSessionTrajectory(sessionId: string): Promise<TrajectoryRecord[]> {
    return this.store.getSessionRecords(sessionId)
  }

  /**
   * Search trajectory records by keyword (substring match in content/summary)
   */
  async search(keyword: string, limit: number = 10): Promise<TrajectoryRecord[]> {
    const result = await this.query({ keyword, limit })
    return result.records
  }

  /**
   * Delete all records for a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.store.deleteSession(sessionId)
  }

  /**
   * Get trajectory statistics
   */
  async getStats(): Promise<TrajectoryStats> {
    const allIds = await this.store.getAllIds()
    const records: TrajectoryRecord[] = []
    
    for (const id of allIds) {
      const record = await this.store.get(id)
      if (record) records.push(record)
    }
    
    const sessions = new Set<string>()
    const typeCount: Record<TrajectoryType, number> = {
      user_input: 0,
      assistant_response: 0,
      tool_call: 0,
      tool_result: 0,
      plan_step: 0,
      verification: 0,
      error: 0,
      session_start: 0,
      session_end: 0
    }
    
    let oldestRecord = 0
    let newestRecord = 0
    
    for (const record of records) {
      sessions.add(record.sessionId)
      typeCount[record.type] = (typeCount[record.type] || 0) + 1
      
      if (oldestRecord === 0 || record.timestamp < oldestRecord) {
        oldestRecord = record.timestamp
      }
      if (record.timestamp > newestRecord) {
        newestRecord = record.timestamp
      }
    }
    
    return {
      totalRecords: records.length,
      totalSessions: sessions.size,
      recordsByType: typeCount,
      oldestRecord,
      newestRecord
    }
  }
}

// Singleton instance
let serviceInstance: TrajectoryService | null = null

export function getTrajectoryService(): TrajectoryService {
  if (!serviceInstance) {
    serviceInstance = new TrajectoryService()
  }
  return serviceInstance
}

export function initTrajectoryService(): TrajectoryService {
  serviceInstance = new TrajectoryService()
  return serviceInstance
}