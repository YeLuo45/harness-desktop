/**
 * P10: Skill System - SkillManager Tests
 * 
 * TDD tests for reusable prompt template system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SkillManager, skillManager, type SkillTemplate, type SkillCategory } from '../services/skills'

// Mock localStorage for node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

describe('SkillManager', () => {
  let manager: SkillManager

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    manager = new SkillManager()
  })

  describe('initialize', () => {
    it('should load skills from localStorage', async () => {
      // Pre-populate localStorage
      const skills: SkillTemplate[] = [
        {
          id: 'test-skill',
          name: 'Test Skill',
          description: 'A test skill',
          category: 'coding',
          template: 'Hello {{name}}',
          variables: [{ name: 'name', type: 'string', description: 'Name', required: true }],
          version: '1.0.0',
          tags: ['test'],
          useCount: 0,
          enabled: true,
          isBuiltIn: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]
      localStorage.setItem('harness_skills', JSON.stringify(skills))

      const newManager = new SkillManager()
      await newManager.initialize()

      const skill = newManager.get('test-skill')
      expect(skill).toBeDefined()
      expect(skill?.name).toBe('Test Skill')
    })

    it('should have built-in skills registered', async () => {
      await manager.initialize()
      
      const skills = manager.list()
      expect(skills.length).toBeGreaterThan(0)
      
      const codeReview = manager.get('builtin_code_review')
      expect(codeReview).toBeDefined()
      expect(codeReview?.isBuiltIn).toBe(true)
    })
  })

  describe('register', () => {
    it('should register a new skill', () => {
      const skill: SkillTemplate = {
        id: 'my-skill',
        name: 'My Skill',
        description: 'A custom skill',
        category: 'coding',
        template: 'Do something with {{input}}',
        variables: [{ name: 'input', type: 'string', description: 'Input', required: true }],
        version: '1.0.0',
        tags: ['custom'],
        useCount: 0,
        enabled: true,
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      manager.register(skill)

      const retrieved = manager.get('my-skill')
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('My Skill')
    })

    it('should auto-generate ID if not provided', () => {
      const skill: SkillTemplate = {
        name: 'Auto ID Skill',
        description: 'Auto generates ID',
        category: 'custom',
        template: 'Hello',
        variables: [],
        version: '1.0.0',
        tags: [],
        useCount: 0,
        enabled: true,
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      manager.register(skill)

      const skills = manager.list()
      expect(skills.length).toBeGreaterThan(0)
    })

    it('should persist to localStorage', () => {
      const skill: SkillTemplate = {
        id: 'persist-skill',
        name: 'Persist Skill',
        description: 'Should persist',
        category: 'writing',
        template: 'Write about {{topic}}',
        variables: [{ name: 'topic', type: 'string', description: 'Topic', required: true }],
        version: '1.0.0',
        tags: ['persistence'],
        useCount: 0,
        enabled: true,
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      manager.register(skill)

      const stored = localStorage.getItem('harness_skills')
      expect(stored).toBeTruthy()
      
      const skills = JSON.parse(stored!)
      expect(skills.some((s: SkillTemplate) => s.id === 'persist-skill')).toBe(true)
    })
  })

  describe('unregister', () => {
    it('should unregister a skill by ID', () => {
      const skill: SkillTemplate = {
        id: 'to-delete',
        name: 'Delete Me',
        description: 'Will be deleted',
        category: 'custom',
        template: 'Template',
        variables: [],
        version: '1.0.0',
        tags: [],
        useCount: 0,
        enabled: true,
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      manager.register(skill)
      expect(manager.get('to-delete')).toBeDefined()

      const deleted = manager.unregister('to-delete')
      expect(deleted).toBe(true)
      expect(manager.get('to-delete')).toBeUndefined()
    })

    it('should return false for non-existent skill', () => {
      const deleted = manager.unregister('non-existent')
      expect(deleted).toBe(false)
    })

    it('should not allow deleting built-in skills', async () => {
      await manager.initialize()
      
      const deleted = manager.unregister('builtin_code_review')
      expect(deleted).toBe(false)
      expect(manager.get('builtin_code_review')).toBeDefined()
    })
  })

  describe('get', () => {
    it('should retrieve skill by ID', () => {
      const skill: SkillTemplate = {
        id: 'get-test',
        name: 'Get Test',
        description: 'Testing get',
        category: 'coding',
        template: 'Code here',
        variables: [],
        version: '1.0.0',
        tags: [],
        useCount: 0,
        enabled: true,
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      manager.register(skill)

      const retrieved = manager.get('get-test')
      expect(retrieved?.name).toBe('Get Test')
    })

    it('should return undefined for non-existent', () => {
      const skill = manager.get('non-existent')
      expect(skill).toBeUndefined()
    })
  })

  describe('update', () => {
    it('should update skill properties', () => {
      const skill: SkillTemplate = {
        id: 'update-test',
        name: 'Original Name',
        description: 'Original desc',
        category: 'coding',
        template: 'Original template',
        variables: [],
        version: '1.0.0',
        tags: [],
        useCount: 0,
        enabled: true,
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      manager.register(skill)

      const updated = manager.update('update-test', { name: 'New Name', description: 'New desc' })
      
      expect(updated?.name).toBe('New Name')
      expect(updated?.description).toBe('New desc')
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(skill.createdAt)
    })

    it('should return null for non-existent', () => {
      const result = manager.update('non-existent', { name: 'Test' })
      expect(result).toBeNull()
    })

    it('should not allow modifying built-in skills', () => {
      manager.register({
        id: 'custom_builtin',
        name: 'Custom Built-in',
        description: 'Test',
        category: 'coding',
        template: 'Template',
        variables: [],
        version: '1.0.0',
        tags: [],
        useCount: 0,
        enabled: true,
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })

      const result = manager.update('custom_builtin', { name: 'Hacked' })
      expect(result?.name).toBe('Custom Built-in')  // Unchanged
    })

    it('should prevent ID change', () => {
      const skill: SkillTemplate = {
        id: 'id-test',
        name: 'ID Test',
        description: 'Testing ID preservation',
        category: 'coding',
        template: 'Template',
        variables: [],
        version: '1.0.0',
        tags: [],
        useCount: 0,
        enabled: true,
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      manager.register(skill)

      const updated = manager.update('id-test', { id: 'hacked-id' } as any)
      expect(updated?.id).toBe('id-test')
    })
  })

  describe('list', () => {
    it('should list all skills', async () => {
      await manager.initialize()
      
      const skills = manager.list()
      expect(skills.length).toBeGreaterThan(0)
    })

    it('should filter by category', async () => {
      await manager.initialize()
      
      const codingSkills = manager.list('coding')
      for (const skill of codingSkills) {
        expect(skill.category).toBe('coding')
      }
    })
  })

  describe('search', () => {
    it('should search by name', async () => {
      await manager.initialize()
      
      const results = manager.search({ name: 'Code' })
      expect(results.some(s => s.name.includes('Code'))).toBe(true)
    })

    it('should search by free text query', async () => {
      await manager.initialize()
      
      const results = manager.search({ query: 'review' })
      expect(results.length).toBeGreaterThan(0)
    })

    it('should filter by enabled status', async () => {
      await manager.initialize()
      
      const enabled = manager.search({ enabled: true })
      for (const skill of enabled) {
        expect(skill.enabled).toBe(true)
      }
    })

    it('should support pagination', async () => {
      await manager.initialize()
      
      const page1 = manager.search({ limit: 2, offset: 0 })
      const page2 = manager.search({ limit: 2, offset: 2 })
      
      expect(page1.length).toBeLessThanOrEqual(2)
      // Page 2 should have different skills (if available)
    })
  })

  describe('render', () => {
    it('should render template with variables', async () => {
      await manager.initialize()
      
      const rendered = manager.render('builtin_code_review', { code: 'function test() {}' })
      
      expect(rendered).toContain('function test() {}')
      expect(rendered.toLowerCase()).toContain('review')
    })

    it('should throw for non-existent skill', () => {
      expect(() => manager.render('non-existent', {})).toThrow('Skill not found')
    })

    it('should handle optional variables', async () => {
      await manager.initialize()
      
      // Debug skill has optional context variable
      const rendered = manager.render('builtin_debug_assistant', { 
        error: 'TypeError: undefined' 
        // code and context are optional
      })
      
      expect(rendered).toContain('TypeError: undefined')
    })

    it('should throw on missing required variable in strict mode', async () => {
      await manager.initialize()
      
      expect(() => 
        manager.render('builtin_code_review', {}, { strict: true })
      ).toThrow('Missing required variable: code')
    })

    it('should use default values when configured', async () => {
      await manager.initialize()
      
      // Test Generator has default for style
      const rendered = manager.render('builtin_test_generator', {
        code: 'function add(a, b) { return a + b }',
        framework: 'jest'
        // style should use default 'AAA'
      }, { defaults: true })
      
      expect(rendered).toContain('function add(a, b) { return a + b }')
      expect(rendered).toContain('jest')
    })
  })

  describe('execute', () => {
    it('should execute and record usage', async () => {
      await manager.initialize()
      
      const execution = await manager.execute('builtin_explain_code', { code: 'let x = 1' })
      
      expect(execution.skillId).toBe('builtin_explain_code')
      expect(execution.renderedPrompt).toContain('let x = 1')
      expect(execution.executedAt).toBeDefined()
    })

    it('should increment use count', async () => {
      await manager.initialize()
      
      const before = manager.get('builtin_code_review')?.useCount || 0
      
      await manager.execute('builtin_code_review', { code: 'let x = 1' })
      
      const after = manager.get('builtin_code_review')?.useCount
      expect(after).toBeGreaterThan(before)
    })

    it('should record last used time', async () => {
      await manager.initialize()
      
      await manager.execute('builtin_code_review', { code: 'let x = 1' })
      
      const skill = manager.get('builtin_code_review')
      expect(skill?.lastUsedAt).toBeDefined()
    })
  })

  describe('getExecutionHistory', () => {
    it('should return execution history', async () => {
      await manager.initialize()
      
      await manager.execute('builtin_code_review', { code: 'test1' })
      await manager.execute('builtin_explain_code', { code: 'test2' })
      
      const history = manager.getExecutionHistory()
      expect(history.length).toBe(2)
    })

    it('should limit history to specified count', async () => {
      await manager.initialize()
      
      for (let i = 0; i < 5; i++) {
        await manager.execute('builtin_code_review', { code: `test${i}` })
      }
      
      const history = manager.getExecutionHistory(3)
      expect(history.length).toBe(3)
    })
  })

  describe('getByCategory', () => {
    it('should return skills by category', async () => {
      await manager.initialize()
      
      const coding = manager.getByCategory('coding')
      expect(coding.every(s => s.category === 'coding')).toBe(true)
    })
  })

  describe('getPopular', () => {
    it('should return most used skills', async () => {
      await manager.initialize()
      
      // Use some skills
      await manager.execute('builtin_code_review', { code: 'a' })
      await manager.execute('builtin_code_review', { code: 'b' })
      await manager.execute('builtin_explain_code', { code: 'c' })
      
      const popular = manager.getPopular(5)
      expect(popular[0]?.name).toBe('Code Review')  // Most used
    })
  })

  describe('getRecent', () => {
    it('should return recently used skills', async () => {
      await manager.initialize()
      
      await manager.execute('builtin_code_review', { code: 'a' })
      await new Promise(r => setTimeout(r, 5))
      await manager.execute('builtin_explain_code', { code: 'b' })
      
      const recent = manager.getRecent(5)
      expect(recent[0]?.name).toBe('Explain Code')  // Most recent
    })
  })

  describe('getCategories', () => {
    it('should return category counts', async () => {
      await manager.initialize()
      
      const categories = manager.getCategories()
      
      expect(categories.coding).toBeGreaterThan(0)
      expect(typeof categories.coding).toBe('number')
      expect(typeof categories.debugging).toBe('number')
    })
  })
})

describe('Built-in Skills', () => {
  let manager: SkillManager

  beforeEach(() => {
    localStorage.clear()
    manager = new SkillManager()
  })

  it('should have Code Review skill', async () => {
    await manager.initialize()
    
    const skill = manager.get('builtin_code_review')
    expect(skill).toBeDefined()
    expect(skill?.name).toBe('Code Review')
    expect(skill?.isBuiltIn).toBe(true)
  })

  it('should have Explain Code skill', async () => {
    await manager.initialize()
    
    const skill = manager.get('builtin_explain_code')
    expect(skill).toBeDefined()
    expect(skill?.name).toBe('Explain Code')
  })

  it('should have Debug Assistant skill', async () => {
    await manager.initialize()
    
    const skill = manager.get('builtin_debug_assistant')
    expect(skill).toBeDefined()
    expect(skill?.name).toBe('Debug Assistant')
  })

  it('should have Test Generator skill', async () => {
    await manager.initialize()
    
    const skill = manager.get('builtin_test_generator')
    expect(skill).toBeDefined()
    expect(skill?.name).toBe('Test Generator')
  })

  it('should have Refactoring Plan skill', async () => {
    await manager.initialize()
    
    const skill = manager.get('builtin_refactoring_plan')
    expect(skill).toBeDefined()
    expect(skill?.name).toBe('Refactoring Plan')
  })
})