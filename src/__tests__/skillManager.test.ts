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

// ========== Skill Market Tests ==========

import { createSkillMarket } from '../services/skills/skillMarket'

describe('SkillMarket', () => {
  let manager: SkillManager
  let market: ReturnType<typeof createSkillMarket>

  beforeEach(async () => {
    localStorage.clear()
    manager = new SkillManager()
    await manager.initialize()
    market = createSkillMarket(
      (id) => manager.get(id),
      () => manager.list()
    )
  })

  describe('exportSkill', () => {
    it('should export a single skill as JSON', () => {
      const json = market.exportSkill('builtin_code_review')
      
      expect(json).toBeTruthy()
      const parsed = JSON.parse(json)
      expect(parsed.version).toBe('1.0.0')
      expect(parsed.skills).toHaveLength(1)
      expect(parsed.skills[0].name).toBe('Code Review')
    })

    it('should throw for non-existent skill', () => {
      expect(() => market.exportSkill('non-existent')).toThrow('Skill not found')
    })
  })

  describe('exportAllSkills', () => {
    it('should export all skills as JSON', () => {
      const json = market.exportAllSkills()
      
      expect(json).toBeTruthy()
      const parsed = JSON.parse(json)
      expect(parsed.version).toBe('1.0.0')
      expect(Array.isArray(parsed.skills)).toBe(true)
      expect(parsed.skills.length).toBeGreaterThan(0)
    })
  })

  describe('importSkill', () => {
    it('should import a skill from JSON', async () => {
      const skill: SkillTemplate = {
        id: 'export-test',
        name: 'Export Test',
        description: 'Testing export/import',
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
      manager.register(skill)

      const json = market.exportSkill('export-test')
      const imported = market.importSkill(json)

      expect(imported.name).toBe('Export Test')
      expect(imported.id).not.toBe('export-test')  // Should get new ID
      expect(imported.id).toContain('imported_')
    })

    it('should throw for invalid JSON', () => {
      expect(() => market.importSkill('not valid json')).toThrow('Invalid JSON format')
    })

    it('should throw for invalid skill schema', () => {
      const invalid = JSON.stringify({ version: '1.0.0', skills: [{ invalid: 'schema' }] })
      expect(() => market.importSkill(invalid)).toThrow('No valid skill found')
    })
  })

  describe('importSkills', () => {
    it('should import multiple skills', () => {
      const json = market.exportAllSkills()
      const imported = market.importSkills(json)

      expect(Array.isArray(imported)).toBe(true)
      // Each imported skill should have a new ID
      for (const skill of imported) {
        expect(skill.id).toContain('imported_')
      }
    })
  })

  describe('validateSkillSchema', () => {
    it('should validate correct skill schema', () => {
      const validSkill = {
        id: 'test',
        name: 'Test',
        description: 'Test desc',
        category: 'coding',
        template: 'Hello',
        variables: [],
        version: '1.0.0',
        tags: []
      }
      expect(market.validateSkillSchema(validSkill)).toBe(true)
    })

    it('should reject invalid schema', () => {
      expect(market.validateSkillSchema(null)).toBe(false)
      expect(market.validateSkillSchema({})).toBe(false)
      expect(market.validateSkillSchema({ id: 'test' })).toBe(false)
    })
  })
})

// ========== Skill Chain Tests ==========

import { createSkillChainExecutor, createSkillChain } from '../services/skills/skillChain'

describe('SkillChainExecutor', () => {
  let manager: SkillManager
  let executor: ReturnType<typeof createSkillChainExecutor>

  beforeEach(async () => {
    localStorage.clear()
    manager = new SkillManager()
    await manager.initialize()
    executor = createSkillChainExecutor(
      (id) => manager.get(id),
      (skillId, vars) => manager.render(skillId, vars)
    )
  })

  describe('execute', () => {
    it('should execute skills in sequence', async () => {
      const chain = createSkillChain(
        'test-chain',
        'Test Chain',
        ['builtin_code_review', 'builtin_explain_code'],
        'continue'
      )

      const result = await executor.execute(chain, { code: 'function test() {}' })

      expect(result.chainId).toBe('test-chain')
      expect(result.results).toHaveLength(2)
      expect(result.results[0].skillId).toBe('builtin_code_review')
      expect(result.results[0].success).toBe(true)
      expect(result.results[1].skillId).toBe('builtin_explain_code')
      expect(result.results[1].success).toBe(true)
      expect(result.totalDuration).toBeGreaterThanOrEqual(0)
    })

    it('should stop on error when onError is stop', async () => {
      const chain = createSkillChain(
        'stop-chain',
        'Stop Chain',
        ['builtin_code_review', 'non-existent'],
        'stop'
      )

      const result = await executor.execute(chain, { code: 'test' })

      expect(result.results).toHaveLength(1)
      expect(result.results[0].skillId).toBe('builtin_code_review')
      expect(result.results[0].success).toBe(true)
    })

    it('should continue on error when onError is continue', async () => {
      const chain = createSkillChain(
        'continue-chain',
        'Continue Chain',
        ['builtin_code_review', 'non-existent', 'builtin_explain_code'],
        'continue'
      )

      const result = await executor.execute(chain, { code: 'test' })

      expect(result.results).toHaveLength(3)
      expect(result.results[0].success).toBe(true)
      expect(result.results[1].success).toBe(false)
      expect(result.results[1].error).toContain('Skill not found')
      expect(result.results[2].success).toBe(true)
    })
  })

  describe('executeSkill', () => {
    it('should execute a single skill', async () => {
      const result = await executor.executeSkill('builtin_code_review', { code: 'let x = 1' })

      expect(result).toBeDefined()
      expect((result as any).skillId).toBe('builtin_code_review')
      expect((result as any).rendered).toContain('let x = 1')
    })

    it('should throw for non-existent skill', async () => {
      await expect(executor.executeSkill('non-existent', {})).rejects.toThrow('Skill not found')
    })
  })
})

// ========== Version Management Tests ==========

describe('SkillManager Version Management', () => {
  let manager: SkillManager

  beforeEach(async () => {
    localStorage.clear()
    manager = new SkillManager()
    
    // Register a test skill
    manager.register({
      id: 'version-test',
      name: 'Version Test',
      description: 'Testing versions',
      category: 'coding',
      template: 'Original template',
      variables: [],
      version: '1.0.0',
      tags: ['test'],
      useCount: 0,
      enabled: true,
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
  })

  describe('getVersions', () => {
    it('should return empty array for skill with no versions', () => {
      const versions = manager.getVersions('version-test')
      expect(versions).toEqual([])
    })

    it('should return versions after adding them', () => {
      manager.addVersion('version-test', '1.0.0', manager.get('version-test')!)
      manager.addVersion('version-test', '2.0.0', {
        ...manager.get('version-test')!,
        template: 'Updated template',
        version: '2.0.0'
      })

      const versions = manager.getVersions('version-test')
      expect(versions).toHaveLength(2)
      expect(versions[0].version).toBe('1.0.0')
      expect(versions[1].version).toBe('2.0.0')
    })
  })

  describe('addVersion', () => {
    it('should add a new version', () => {
      const skill = manager.get('version-test')!
      manager.addVersion('version-test', '1.0.0', skill)

      const versions = manager.getVersions('version-test')
      expect(versions).toHaveLength(1)
      expect(versions[0].version).toBe('1.0.0')
    })

    it('should update existing version', () => {
      const skill = manager.get('version-test')!
      manager.addVersion('version-test', '1.0.0', skill)
      
      const updatedSkill = { ...skill, template: 'Updated' }
      manager.addVersion('version-test', '1.0.0', updatedSkill)

      const versions = manager.getVersions('version-test')
      expect(versions).toHaveLength(1)
      expect(versions[0].template.template).toBe('Updated')
    })

    it('should throw for non-existent skill', () => {
      expect(() => manager.addVersion('non-existent', '1.0.0', {} as SkillTemplate))
        .toThrow('Skill not found')
    })
  })

  describe('useVersion', () => {
    it('should switch to a different version', () => {
      const skill = manager.get('version-test')!
      
      manager.addVersion('version-test', '1.0.0', skill)
      manager.addVersion('version-test', '2.0.0', {
        ...skill,
        template: 'Version 2 template',
        version: '2.0.0'
      })

      manager.useVersion('version-test', '2.0.0')

      const currentSkill = manager.get('version-test')
      expect(currentSkill?.template).toBe('Version 2 template')
      expect(currentSkill?.version).toBe('2.0.0')
    })

    it('should throw for non-existent version', () => {
      manager.addVersion('version-test', '1.0.0', manager.get('version-test')!)
      
      expect(() => manager.useVersion('version-test', '99.0.0'))
        .toThrow('Version 99.0.0 not found')
    })
  })

  describe('version persistence', () => {
    it('should persist versions to localStorage', () => {
      const skill = manager.get('version-test')!
      manager.addVersion('version-test', '1.0.0', skill)

      const stored = localStorage.getItem('harness_skill_versions')
      expect(stored).toBeTruthy()
    })

    it('should load versions on initialize', async () => {
      const skill = manager.get('version-test')!
      manager.addVersion('version-test', '1.0.0', skill)

      // Create new manager and initialize
      const newManager = new SkillManager()
      await newManager.initialize()

      const versions = newManager.getVersions('version-test')
      expect(versions).toHaveLength(1)
      expect(versions[0].version).toBe('1.0.0')
    })
  })
})