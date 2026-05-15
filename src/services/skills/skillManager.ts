/**
 * P10: Skill System - SkillManager
 * 
 * Core skill management with template rendering and persistence.
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  SkillTemplate,
  SkillRegistry,
  SkillSearchQuery,
  SkillExecution,
  RenderOptions,
  SkillCategory,
  SkillVersion,
  BUILT_IN_SKILLS
} from './types'
import { BUILT_IN_SKILLS as builtInSkillTemplates } from './types'

const STORAGE_KEY = 'harness_skills'
const EXECUTION_KEY = 'harness_skill_executions'

export class SkillManager implements SkillRegistry {
  private skills: Map<string, SkillTemplate> = new Map()
  private skillVersions: Map<string, SkillVersion[]> = new Map()
  private currentVersion: Map<string, string> = new Map()  // skillId -> version
  private initialized: boolean = false

  constructor() {
    this.registerBuiltInSkills()
  }

  /**
   * Initialize and load skills from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Load from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const skills: SkillTemplate[] = JSON.parse(stored)
        skills.forEach(skill => this.skills.set(skill.id, skill))
      }
    } catch (error) {
      console.error('Failed to load skills from storage:', error)
    }

    // Load skill versions
    this.loadVersions()

    this.initialized = true
  }

  /**
   * Register built-in skills
   */
  private registerBuiltInSkills(): void {
    for (const skillTemplate of builtInSkillTemplates) {
      const skill: SkillTemplate = {
        ...skillTemplate,
        id: `builtin_${skillTemplate.name.toLowerCase().replace(/\s+/g, '_')}`,
        useCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      this.skills.set(skill.id, skill)
    }
  }

  /**
   * Register a new skill
   */
  register(skill: SkillTemplate): void {
    const now = Date.now()
    const newSkill: SkillTemplate = {
      ...skill,
      id: skill.id || uuidv4(),
      useCount: skill.useCount || 0,
      createdAt: skill.createdAt || now,
      updatedAt: now
    }
    this.skills.set(newSkill.id, newSkill)
    this.persistSkills()
  }

  /**
   * Unregister a skill by ID
   */
  unregister(id: string): boolean {
    const skill = this.skills.get(id)
    if (!skill) return false

    // Prevent deleting built-in skills
    if (skill.isBuiltIn) {
      console.warn(`Cannot delete built-in skill: ${id}`)
      return false
    }

    const deleted = this.skills.delete(id)
    if (deleted) {
      this.persistSkills()
    }
    return deleted
  }

  /**
   * Get a skill by ID
   */
  get(id: string): SkillTemplate | undefined {
    return this.skills.get(id)
  }

  /**
   * Update a skill
   */
  update(id: string, updates: Partial<SkillTemplate>): SkillTemplate | null {
    const skill = this.skills.get(id)
    if (!skill) return null

    // Prevent modifying built-in skills
    if (skill.isBuiltIn) {
      console.warn(`Cannot modify built-in skill: ${id}`)
      return skill
    }

    const updatedSkill: SkillTemplate = {
      ...skill,
      ...updates,
      id: skill.id,  // Prevent ID change
      isBuiltIn: skill.isBuiltIn,  // Prevent isBuiltIn change
      createdAt: skill.createdAt,  // Preserve creation time
      updatedAt: Date.now()
    }

    this.skills.set(id, updatedSkill)
    this.persistSkills()
    return updatedSkill
  }

  /**
   * List all skills, optionally filtered by category
   */
  list(category?: SkillCategory): SkillTemplate[] {
    const skills = Array.from(this.skills.values())

    if (category) {
      return skills.filter(s => s.category === category)
    }

    return skills
  }

  /**
   * Search skills by name, description, or tags
   */
  search(query: SkillSearchQuery): SkillTemplate[] {
    let results = Array.from(this.skills.values())

    if (query.name) {
      const nameLower = query.name.toLowerCase()
      results = results.filter(s => s.name.toLowerCase().includes(nameLower))
    }

    if (query.category) {
      results = results.filter(s => s.category === query.category)
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(s =>
        query.tags!.some(tag => s.tags.includes(tag))
      )
    }

    if (query.query) {
      const queryLower = query.query.toLowerCase()
      results = results.filter(s =>
        s.name.toLowerCase().includes(queryLower) ||
        s.description.toLowerCase().includes(queryLower) ||
        s.tags.some(t => t.toLowerCase().includes(queryLower))
      )
    }

    if (query.enabled !== undefined) {
      results = results.filter(s => s.enabled === query.enabled)
    }

    // Pagination
    if (query.offset) {
      results = results.slice(query.offset)
    }

    if (query.limit) {
      results = results.slice(0, query.limit)
    }

    return results
  }

  /**
   * Render a skill template with variables
   */
  render(skillId: string, variables: Record<string, unknown>, options: RenderOptions = {}): string {
    const skill = this.skills.get(skillId)
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`)
    }

    return this.renderTemplate(skill.template, variables, skill.variables.map(v => ({ name: v.name, required: v.required ?? false, default: v.defaultValue })), options)
  }

  /**
   * Execute a skill and record the execution
   */
  async execute(skillId: string, variables: Record<string, unknown>, options: RenderOptions = {}): Promise<SkillExecution> {
    const startTime = Date.now()
    const renderedPrompt = this.render(skillId, variables, options)

    const execution: SkillExecution = {
      skillId,
      variables,
      renderedPrompt,
      executedAt: startTime,
      durationMs: Date.now() - startTime
    }

    // Record execution
    this.recordExecution(execution)

    // Update skill usage stats
    const skill = this.skills.get(skillId)
    if (skill) {
      skill.useCount++
      skill.lastUsedAt = Date.now()
      this.persistSkills()
    }

    return execution
  }

  /**
   * Get skill execution history
   */
  getExecutionHistory(limit: number = 10): SkillExecution[] {
    try {
      const stored = localStorage.getItem(EXECUTION_KEY)
      if (stored) {
        const executions: SkillExecution[] = JSON.parse(stored)
        return executions.slice(-limit)
      }
    } catch (error) {
      console.error('Failed to load execution history:', error)
    }
    return []
  }

  /**
   * Get skills by category
   */
  getByCategory(category: SkillCategory): SkillTemplate[] {
    return this.list(category)
  }

  /**
   * Get popular skills (by use count)
   */
  getPopular(limit: number = 5): SkillTemplate[] {
    return Array.from(this.skills.values())
      .filter(s => s.useCount > 0)
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, limit)
  }

  /**
   * Get recently used skills
   */
  getRecent(limit: number = 5): SkillTemplate[] {
    return Array.from(this.skills.values())
      .filter(s => s.lastUsedAt !== undefined)
      .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
      .slice(0, limit)
  }

  /**
   * Get all categories with skill counts
   */
  getCategories(): Record<SkillCategory, number> {
    const categories: Record<SkillCategory, number> = {
      coding: 0,
      debugging: 0,
      review: 0,
      planning: 0,
      research: 0,
      writing: 0,
      creative: 0,
      custom: 0
    }

    for (const skill of this.skills.values()) {
      categories[skill.category]++
    }

    return categories
  }

  // ========== Version Management ==========

  /**
   * Get all versions for a skill
   */
  getVersions(skillId: string): SkillVersion[] {
    return this.skillVersions.get(skillId) || []
  }

  /**
   * Add a new version for a skill
   */
  addVersion(skillId: string, version: string, template: SkillTemplate): void {
    const skill = this.skills.get(skillId)
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`)
    }

    const versions = this.skillVersions.get(skillId) || []
    
    // Check if version already exists
    const existingIndex = versions.findIndex(v => v.version === version)
    if (existingIndex >= 0) {
      // Update existing version
      versions[existingIndex] = {
        version,
        createdAt: Date.now(),
        template
      }
    } else {
      // Add new version
      versions.push({
        version,
        createdAt: Date.now(),
        template
      })
    }

    this.skillVersions.set(skillId, versions)
    this.currentVersion.set(skillId, version)
    
    // Persist versions
    this.persistVersions()
  }

  /**
   * Use a specific version of a skill
   */
  useVersion(skillId: string, version: string): void {
    const versions = this.skillVersions.get(skillId)
    if (!versions) {
      throw new Error(`No versions found for skill: ${skillId}`)
    }

    const found = versions.find(v => v.version === version)
    if (!found) {
      throw new Error(`Version ${version} not found for skill: ${skillId}`)
    }

    this.currentVersion.set(skillId, version)
    
    // Update the current skill with the version's template
    const skill = this.skills.get(skillId)
    if (skill) {
      skill.template = found.template.template
      skill.version = found.version
      skill.updatedAt = Date.now()
      this.persistSkills()
    }
  }

  /**
   * Persist versions to localStorage
   */
  private persistVersions(): void {
    try {
      const versionsData: Array<{ skillId: string; versions: SkillVersion[]; current: string }> = []
      
      for (const [skillId, versions] of this.skillVersions.entries()) {
        versionsData.push({
          skillId,
          versions,
          current: this.currentVersion.get(skillId) || ''
        })
      }

      localStorage.setItem('harness_skill_versions', JSON.stringify(versionsData))
    } catch (error) {
      console.error('Failed to persist skill versions:', error)
    }
  }

  /**
   * Load versions from localStorage
   */
  private loadVersions(): void {
    try {
      const stored = localStorage.getItem('harness_skill_versions')
      if (stored) {
        const versionsData = JSON.parse(stored) as Array<{ skillId: string; versions: SkillVersion[]; current: string }>
        
        for (const data of versionsData) {
          this.skillVersions.set(data.skillId, data.versions)
          this.currentVersion.set(data.skillId, data.current)
        }
      }
    } catch (error) {
      console.error('Failed to load skill versions:', error)
    }
  }

  // ========== Private Methods ==========

  /**
   * Render template string with variable substitution
   */
  private renderTemplate(
    template: string,
    variables: Record<string, unknown>,
    variableDefs: Array<{ name: string; required: boolean; default?: unknown }>,
    options: RenderOptions
  ): string {
    let result = template

    for (const varDef of variableDefs) {
      const placeholder = `{{${varDef.name}}}`
      const value = variables[varDef.name]

      if (value !== undefined) {
        result = result.replace(new RegExp(this.escapeRegex(placeholder), 'g'), String(value))
      } else if (varDef.default !== undefined && options.defaults) {
        result = result.replace(new RegExp(this.escapeRegex(placeholder), 'g'), String(varDef.default))
      } else if (varDef.required && options.strict) {
        throw new Error(`Missing required variable: ${varDef.name}`)
      }
    }

    return result
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Record skill execution to history
   */
  private recordExecution(execution: SkillExecution): void {
    try {
      const stored = localStorage.getItem(EXECUTION_KEY)
      const executions: SkillExecution[] = stored ? JSON.parse(stored) : []
      executions.push(execution)

      // Keep last 100 executions
      if (executions.length > 100) {
        executions.shift()
      }

      localStorage.setItem(EXECUTION_KEY, JSON.stringify(executions))
    } catch (error) {
      console.error('Failed to record execution:', error)
    }
  }

  /**
   * Persist skills to localStorage
   */
  private persistSkills(): void {
    try {
      const skills = Array.from(this.skills.values())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(skills))
    } catch (error) {
      console.error('Failed to persist skills:', error)
    }
  }
}

// Export singleton
export const skillManager = new SkillManager()