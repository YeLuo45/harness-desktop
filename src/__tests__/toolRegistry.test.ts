import { describe, it, expect, beforeEach } from 'vitest'
import type { ToolRegistryEntry, ToolQuery, ToolCategory, ToolDefinition, ToolExecutionResult } from '../services/tools/types'
import { ToolRegistry, getToolRegistry, initToolRegistry } from '../services/tools/toolRegistry'
import type { ToolExecutor } from '../services/tools/types'

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
  })

  afterEach(() => {
    registry.clear()
  })

  // ============================================
  // Types
  // ============================================

  describe('ToolRegistryEntry', () => {
    it('should have required fields', () => {
      const entry: ToolRegistryEntry = {
        id: 'test-id',
        name: 'test_tool',
        description: 'A test tool',
        version: '1.0.0',
        definition: {
          name: 'test_tool',
          description: 'A test tool',
          parameters: { type: 'object', properties: {} }
        },
        factory: async () => ({
          execute: async () => ({ success: true, result: 'ok' })
        }),
        registeredAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true,
        category: 'custom',
        tags: ['test']
      }

      expect(entry.name).toBe('test_tool')
      expect(entry.enabled).toBe(true)
      expect(entry.category).toBe('custom')
    })
  })

  // ============================================
  // Registration
  // ============================================

  describe('register()', () => {
    it('should register a tool and return id', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true, result: 'hello' })
      }

      const id = registry.register({
        name: 'greet',
        description: 'Greet someone',
        version: '1.0.0',
        definition: {
          name: 'greet',
          description: 'Greet someone',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name to greet' }
            },
            required: ['name']
          }
        },
        factory: async () => executor,
        category: 'custom',
        tags: ['greeting']
      })

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
    })

    it('should store tool with correct metadata', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'test_tool',
        description: 'Test tool',
        version: '1.0.0',
        definition: {
          name: 'test_tool',
          description: 'Test tool',
          parameters: { type: 'object', properties: {} }
        },
        factory: async () => executor,
        category: 'bash',
        tags: ['test']
      })

      const entry = registry.get('test_tool')
      expect(entry).not.toBeNull()
      expect(entry!.name).toBe('test_tool')
      expect(entry!.category).toBe('bash')
      expect(entry!.enabled).toBe(true)
    })

    it('should reject duplicate name registration', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'duplicate',
        description: 'First',
        version: '1.0.0',
        definition: { name: 'duplicate', description: 'First', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'custom',
        tags: []
      })

      expect(() => {
        registry.register({
          name: 'duplicate',
          description: 'Second',
          version: '1.0.0',
          definition: { name: 'duplicate', description: 'Second', parameters: { type: 'object', properties: {} } },
          factory: async () => executor,
          category: 'custom',
          tags: []
        })
      }).toThrow('already registered')
    })

    it('should set registeredAt and updatedAt on registration', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      const before = Date.now()
      registry.register({
        name: 'timed',
        description: 'Test',
        version: '1.0.0',
        definition: { name: 'timed', description: 'Test', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'custom',
        tags: []
      })
      const after = Date.now()

      const entry = registry.get('timed')!
      expect(entry.registeredAt).toBeGreaterThanOrEqual(before)
      expect(entry.registeredAt).toBeLessThanOrEqual(after)
      expect(entry.updatedAt).toBe(entry.registeredAt)
    })
  })

  describe('unregister()', () => {
    it('should unregister a tool', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'to_delete',
        description: 'Will be deleted',
        version: '1.0.0',
        definition: { name: 'to_delete', description: 'Will be deleted', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'custom',
        tags: []
      })

      const result = registry.unregister('to_delete')
      expect(result).toBe(true)
      expect(registry.get('to_delete')).toBeNull()
    })

    it('should return false for non-existent tool', () => {
      const result = registry.unregister('non_existent')
      expect(result).toBe(false)
    })
  })

  // ============================================
  // Retrieval
  // ============================================

  describe('get()', () => {
    it('should retrieve registered tool', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'get_test',
        description: 'Get test',
        version: '1.0.0',
        definition: { name: 'get_test', description: 'Get test', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'file',
        tags: ['test']
      })

      const entry = registry.get('get_test')
      expect(entry).not.toBeNull()
      expect(entry!.name).toBe('get_test')
    })

    it('should return null for non-existent tool', () => {
      expect(registry.get('non_existent')).toBeNull()
    })
  })

  describe('getAll()', () => {
    it('should return all registered tools', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'tool1',
        description: 'Tool 1',
        version: '1.0.0',
        definition: { name: 'tool1', description: 'Tool 1', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'file',
        tags: []
      })

      registry.register({
        name: 'tool2',
        description: 'Tool 2',
        version: '1.0.0',
        definition: { name: 'tool2', description: 'Tool 2', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'bash',
        tags: []
      })

      const all = registry.getAll()
      expect(all.length).toBeGreaterThanOrEqual(2)
      expect(all.some(t => t.name === 'tool1')).toBe(true)
      expect(all.some(t => t.name === 'tool2')).toBe(true)
    })
  })

  // ============================================
  // Query
  // ============================================

  describe('query()', () => {
    beforeEach(async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'read_file',
        description: 'Read a file',
        version: '1.0.0',
        definition: { name: 'read_file', description: 'Read a file', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'file',
        tags: ['io', 'read']
      })

      registry.register({
        name: 'write_file',
        description: 'Write a file',
        version: '1.0.0',
        definition: { name: 'write_file', description: 'Write a file', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'file',
        tags: ['io', 'write']
      })

      registry.register({
        name: 'run_bash',
        description: 'Run bash command',
        version: '1.0.0',
        definition: { name: 'run_bash', description: 'Run bash command', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'bash',
        tags: ['shell']
      })
    })

    it('should filter by category', () => {
      const results = registry.query({ category: 'file' })
      expect(results.length).toBe(2)
      expect(results.every(t => t.category === 'file')).toBe(true)
    })

    it('should filter by tags', () => {
      const results = registry.query({ tags: ['io'] })
      expect(results.length).toBe(2)
      expect(results.some(t => t.name === 'read_file')).toBe(true)
      expect(results.some(t => t.name === 'write_file')).toBe(true)
    })

    it('should filter by enabled status', () => {
      registry.disable('read_file')
      const results = registry.query({ enabled: false })
      expect(results.some(t => t.name === 'read_file')).toBe(true)
    })

    it('should search by name/description', () => {
      const results = registry.query({ search: 'bash' })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('run_bash')
    })

    it('should combine multiple filters', () => {
      const results = registry.query({ category: 'file', tags: ['write'] })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('write_file')
    })
  })

  // ============================================
  // Available Tools (for LLM)
  // ============================================

  describe('getAvailableTools()', () => {
    it('should return ToolDefinition array for LLM', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'available_tool',
        description: 'An available tool',
        version: '1.0.0',
        definition: {
          name: 'available_tool',
          description: 'An available tool',
          parameters: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Input text' }
            }
          }
        },
        factory: async () => executor,
        category: 'custom',
        tags: []
      })

      const tools = registry.getAvailableTools()
      expect(Array.isArray(tools)).toBe(true)
      expect(tools.some(t => t.name === 'available_tool')).toBe(true)
    })

    it('should exclude disabled tools', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'disabled_tool',
        description: 'A disabled tool',
        version: '1.0.0',
        definition: { name: 'disabled_tool', description: 'A disabled tool', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'custom',
        tags: []
      })

      registry.disable('disabled_tool')

      const tools = registry.getAvailableTools()
      expect(tools.some(t => t.name === 'disabled_tool')).toBe(false)
    })
  })

  // ============================================
  // Enable/Disable
  // ============================================

  describe('enable()', () => {
    it('should enable a disabled tool', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'to_enable',
        description: 'To be enabled',
        version: '1.0.0',
        definition: { name: 'to_enable', description: 'To be enabled', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'custom',
        tags: []
      })

      registry.disable('to_enable')
      expect(registry.get('to_enable')!.enabled).toBe(false)

      registry.enable('to_enable')
      expect(registry.get('to_enable')!.enabled).toBe(true)
    })
  })

  describe('disable()', () => {
    it('should disable an enabled tool', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'to_disable',
        description: 'To be disabled',
        version: '1.0.0',
        definition: { name: 'to_disable', description: 'To be disabled', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'custom',
        tags: []
      })

      expect(registry.get('to_disable')!.enabled).toBe(true)

      registry.disable('to_disable')
      expect(registry.get('to_disable')!.enabled).toBe(false)
    })

    it('should return false for non-existent tool', () => {
      const result = registry.disable('non_existent')
      expect(result).toBe(false)
    })
  })

  // ============================================
  // Utility
  // ============================================

  describe('has()', () => {
    it('should return true for registered tool', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'has_test',
        description: 'Has test',
        version: '1.0.0',
        definition: { name: 'has_test', description: 'Has test', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'custom',
        tags: []
      })

      expect(registry.has('has_test')).toBe(true)
    })

    it('should return false for non-registered tool', () => {
      expect(registry.has('non_existent')).toBe(false)
    })
  })

  describe('getStats()', () => {
    it('should return category counts', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'file_tool',
        description: 'File tool',
        version: '1.0.0',
        definition: { name: 'file_tool', description: 'File tool', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'file',
        tags: []
      })

      registry.register({
        name: 'bash_tool',
        description: 'Bash tool',
        version: '1.0.0',
        definition: { name: 'bash_tool', description: 'Bash tool', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'bash',
        tags: []
      })

      const stats = registry.getStats()
      expect(stats['file']).toBeGreaterThanOrEqual(1)
      expect(stats['bash']).toBeGreaterThanOrEqual(1)
    })
  })

  describe('clear()', () => {
    it('should remove all tools', async () => {
      const executor: ToolExecutor = {
        execute: async () => ({ success: true })
      }

      registry.register({
        name: 'clear_test',
        description: 'Clear test',
        version: '1.0.0',
        definition: { name: 'clear_test', description: 'Clear test', parameters: { type: 'object', properties: {} } },
        factory: async () => executor,
        category: 'custom',
        tags: []
      })

      registry.clear()
      expect(registry.getAll().length).toBe(0)
    })
  })
})

describe('ToolRegistry Singleton', () => {
  it('should provide singleton instance', () => {
    const instance1 = getToolRegistry()
    const instance2 = getToolRegistry()
    expect(instance1).toBe(instance2)
  })

  it('should init and register built-in tools', () => {
    initToolRegistry()
    const registry = getToolRegistry()

    // Built-in tools should be registered
    expect(registry.has('file_read') || registry.has('bash_execute')).toBeTruthy()
  })
})