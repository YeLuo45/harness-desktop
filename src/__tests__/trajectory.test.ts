import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { TrajectoryRecord, TrajectoryQuery, TrajectoryResult, TrajectoryStats } from '../services/trajectory/types'
import { TrajectoryService } from '../services/trajectory/trajectoryService'

describe('TrajectoryService', () => {
  let service: TrajectoryService
  let recordedIds: string[] = []

  beforeEach(() => {
    service = new TrajectoryService()
    recordedIds = []
  })

  afterEach(async () => {
    // Cleanup
    for (const id of recordedIds) {
      await service.delete(id)
    }
  })

  // ============================================
  // TrajectoryRecord Types
  // ============================================

  describe('TrajectoryRecord', () => {
    it('should have required fields', () => {
      const record: TrajectoryRecord = {
        id: 'test-1',
        sessionId: 'session-1',
        turn: 1,
        role: 'user',
        content: 'Hello',
        summary: 'User said hello',
        timestamp: Date.now(),
        type: 'user_input',
        tags: [],
        associations: []
      }

      expect(record.id).toBe('test-1')
      expect(record.sessionId).toBe('session-1')
      expect(record.role).toBe('user')
      expect(record.type).toBe('user_input')
    })

    it('should support tool_call type', () => {
      const record: TrajectoryRecord = {
        id: 'tool-1',
        sessionId: 'session-1',
        turn: 2,
        role: 'tool',
        content: '{"name":"bash","arguments":{"command":"ls"}}',
        summary: 'bash tool call',
        timestamp: Date.now(),
        type: 'tool_call',
        tags: ['bash'],
        associations: []
      }

      expect(record.type).toBe('tool_call')
      expect(record.tags).toContain('bash')
    })
  })

  // ============================================
  // Basic CRUD
  // ============================================

  describe('record()', () => {
    it('should record a trajectory event and return record with id', async () => {
      const event = {
        sessionId: 'session-1',
        turn: 1,
        role: 'user' as const,
        content: 'Hello world',
        summary: 'User greeting',
        type: 'user_input' as const,
        tags: [],
        associations: []
      }

      const record = await service.record(event)
      recordedIds.push(record.id)

      expect(record.id).toBeDefined()
      expect(record.timestamp).toBeDefined()
      expect(record.content).toBe('Hello world')
    })

    it('should auto-generate id if not provided', async () => {
      const event = {
        sessionId: 'session-1',
        turn: 1,
        role: 'assistant' as const,
        content: 'Hi there',
        summary: 'Assistant greeting',
        type: 'assistant_response' as const,
        tags: [],
        associations: []
      }

      const record = await service.record(event)
      recordedIds.push(record.id)

      expect(record.id).toBeTruthy()
    })

    it('should record session_start event', async () => {
      const event = {
        sessionId: 'session-new',
        turn: 0,
        role: 'system' as const,
        content: 'Session started',
        summary: 'New session',
        type: 'session_start' as const,
        tags: [],
        associations: []
      }

      const record = await service.record(event)
      recordedIds.push(record.id)

      expect(record.type).toBe('session_start')
    })
  })

  describe('get()', () => {
    it('should retrieve a record by id', async () => {
      const created = await service.record({
        sessionId: 'session-1',
        turn: 1,
        role: 'user',
        content: 'Test content',
        summary: 'Test',
        type: 'user_input',
        tags: [],
        associations: []
      })
      recordedIds.push(created.id)

      const retrieved = await service.get(created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(created.id)
      expect(retrieved!.content).toBe('Test content')
    })

    it('should return null for non-existent id', async () => {
      const result = await service.get('non-existent-id')
      expect(result).toBeNull()
    })
  })

  describe('delete()', () => {
    it('should delete a record by id', async () => {
      const created = await service.record({
        sessionId: 'session-1',
        turn: 1,
        role: 'user',
        content: 'To be deleted',
        summary: 'Delete me',
        type: 'user_input',
        tags: [],
        associations: []
      })

      const deleted = await service.delete(created.id)
      expect(deleted).toBe(true)

      const retrieved = await service.get(created.id)
      expect(retrieved).toBeNull()
    })

    it('should return false for non-existent id', async () => {
      const result = await service.delete('non-existent-id')
      expect(result).toBe(false)
    })
  })

  // ============================================
  // Query
  // ============================================

  describe('query()', () => {
    beforeEach(async () => {
      // Create test records
      const records = [
        { sessionId: 's1', turn: 1, role: 'user' as const, content: 'Hello', summary: 'Hi', type: 'user_input' as const, tags: ['greeting'], associations: [] },
        { sessionId: 's1', turn: 2, role: 'assistant' as const, content: 'Hi there', summary: 'Response', type: 'assistant_response' as const, tags: [], associations: [] },
        { sessionId: 's1', turn: 3, role: 'tool' as const, content: '{"name":"ls"}', summary: 'ls call', type: 'tool_call' as const, tags: ['bash'], associations: [] },
        { sessionId: 's2', turn: 1, role: 'user' as const, content: 'Different session', summary: 'Other', type: 'user_input' as const, tags: [], associations: [] },
      ]

      for (const r of records) {
        const created = await service.record({ sessionId: r.sessionId, ...r })
        recordedIds.push(created.id)
      }
    })

    it('should query all records with empty query', async () => {
      const result = await service.query({})

      expect(result.total).toBeGreaterThanOrEqual(4)
      expect(result.records.length).toBeGreaterThan(0)
    })

    it('should filter by sessionId', async () => {
      const result = await service.query({ sessionId: 's1' })

      for (const record of result.records) {
        expect(record.sessionId).toBe('s1')
      }
    })

    it('should filter by type', async () => {
      const result = await service.query({ types: ['tool_call'] })

      for (const record of result.records) {
        expect(record.type).toBe('tool_call')
      }
    })

    it('should filter by tags', async () => {
      const result = await service.query({ tags: ['bash'] })

      for (const record of result.records) {
        expect(record.tags).toContain('bash')
      }
    })

    it('should filter by timeRange', async () => {
      const now = Date.now()
      const oneHourAgo = now - 3600 * 1000

      const result = await service.query({ timeRange: { start: oneHourAgo, end: now } })

      for (const record of result.records) {
        expect(record.timestamp).toBeGreaterThanOrEqual(oneHourAgo)
        expect(record.timestamp).toBeLessThanOrEqual(now)
      }
    })

    it('should support limit and offset', async () => {
      const result = await service.query({ limit: 2, offset: 0 })

      expect(result.records.length).toBeLessThanOrEqual(2)
      expect(result.hasMore).toBe(result.records.length === 2)
    })

    it('should keyword search in content', async () => {
      const result = await service.query({ keyword: 'Hello' })

      expect(result.records.length).toBeGreaterThan(0)
      expect(result.records.some(r => r.content.includes('Hello'))).toBe(true)
    })
  })

  // ============================================
  // Session Trajectory
  // ============================================

  describe('getSessionTrajectory()', () => {
    it('should return all records for a session in order', async () => {
      const sessionId = 'test-session-' + Date.now()

      await service.record({ sessionId, turn: 1, role: 'user', content: 'First', summary: 'F', type: 'user_input', tags: [], associations: [] })
      await service.record({ sessionId, turn: 2, role: 'assistant', content: 'Second', summary: 'S', type: 'assistant_response', tags: [], associations: [] })
      await service.record({ sessionId, turn: 3, role: 'tool', content: 'Third', summary: 'T', type: 'tool_call', tags: [], associations: [] })

      const records = await service.getSessionTrajectory(sessionId)

      expect(records.length).toBe(3)
      expect(records[0].turn).toBe(1)
      expect(records[1].turn).toBe(2)
      expect(records[2].turn).toBe(3)

      // Cleanup
      for (const r of records) {
        recordedIds.push(r.id)
      }
    })

    it('should return empty array for non-existent session', async () => {
      const result = await service.getSessionTrajectory('non-existent-session')
      expect(result).toEqual([])
    })
  })

  // ============================================
  // Search
  // ============================================

  describe('search()', () => {
    beforeEach(async () => {
      const records = [
        { sessionId: 's1', turn: 1, role: 'user' as const, content: 'How to fix the bug', summary: 'Bug question', type: 'user_input' as const, tags: ['bug'], associations: [] },
        { sessionId: 's1', turn: 2, role: 'assistant' as const, content: 'Here is the fix', summary: 'Bug fix', type: 'assistant_response' as const, tags: ['bug', 'fix'], associations: [] },
        { sessionId: 's2', turn: 1, role: 'user' as const, content: 'What is React', summary: 'React question', type: 'user_input' as const, tags: [], associations: [] },
      ]

      for (const r of records) {
        const created = await service.record({ sessionId: r.sessionId, ...r })
        recordedIds.push(created.id)
      }
    })

    it('should search by keyword', async () => {
      const results = await service.search('bug')

      expect(results.length).toBeGreaterThan(0)
      expect(results.some(r => r.content.includes('bug') || r.summary.includes('bug'))).toBe(true)
    })

    it('should respect limit', async () => {
      const results = await service.search('fix', 1)

      expect(results.length).toBeLessThanOrEqual(1)
    })
  })

  // ============================================
  // Delete Session
  // ============================================

  describe('deleteSession()', () => {
    it('should delete all records for a session', async () => {
      const sessionId = 'to-delete-' + Date.now()

      await service.record({ sessionId, turn: 1, role: 'user', content: 'A', summary: 'A', type: 'user_input', tags: [], associations: [] })
      await service.record({ sessionId, turn: 2, role: 'user', content: 'B', summary: 'B', type: 'user_input', tags: [], associations: [] })

      await service.deleteSession(sessionId)

      const remaining = await service.getSessionTrajectory(sessionId)
      expect(remaining).toEqual([])
    })
  })

  // ============================================
  // Stats
  // ============================================

  describe('getStats()', () => {
    it('should return trajectory statistics', async () => {
      const stats = await service.getStats()

      expect(stats.totalRecords).toBeGreaterThanOrEqual(0)
      expect(stats.totalSessions).toBeGreaterThanOrEqual(0)
      expect(stats.recordsByType).toBeDefined()
      expect(stats.oldestRecord).toBeDefined()
      expect(stats.newestRecord).toBeDefined()
    })
  })
})
