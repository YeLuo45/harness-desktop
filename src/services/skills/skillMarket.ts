/**
 * P10: Skill System - Skill Market
 * 
 * Import/export/share skills as JSON.
 */

import type { SkillTemplate } from './types'

const MARKET_VERSION = '1.0.0'

export interface SkillMarket {
  exportSkill(skillId: string): string
  exportAllSkills(): string
  importSkill(json: string): SkillTemplate
  importSkills(json: string): SkillTemplate[]
  validateSkillSchema(obj: unknown): boolean
}

interface SkillExportFormat {
  version: string
  exportedAt: number
  skills: SkillTemplate[]
}

function isSkillTemplate(obj: unknown): obj is SkillTemplate {
  if (typeof obj !== 'object' || obj === null) return false
  
  const skill = obj as Record<string, unknown>
  return (
    typeof skill.id === 'string' &&
    typeof skill.name === 'string' &&
    typeof skill.description === 'string' &&
    typeof skill.category === 'string' &&
    typeof skill.template === 'string' &&
    Array.isArray(skill.variables) &&
    typeof skill.version === 'string' &&
    Array.isArray(skill.tags)
  )
}

export class SkillMarketImpl implements SkillMarket {
  constructor(
    private getSkill: (id: string) => SkillTemplate | undefined,
    private listSkills: () => SkillTemplate[]
  ) {}

  exportSkill(skillId: string): string {
    const skill = this.getSkill(skillId)
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`)
    }

    const exportData: SkillExportFormat = {
      version: MARKET_VERSION,
      exportedAt: Date.now(),
      skills: [skill]
    }

    return JSON.stringify(exportData, null, 2)
  }

  exportAllSkills(): string {
    const exportData: SkillExportFormat = {
      version: MARKET_VERSION,
      exportedAt: Date.now(),
      skills: this.listSkills()
    }

    return JSON.stringify(exportData, null, 2)
  }

  importSkill(json: string): SkillTemplate {
    const skills = this.importSkills(json)
    if (skills.length === 0) {
      throw new Error('No valid skill found in JSON')
    }
    return skills[0]
  }

  importSkills(json: string): SkillTemplate[] {
    let parsed: SkillExportFormat

    try {
      parsed = JSON.parse(json)
    } catch {
      throw new Error('Invalid JSON format')
    }

    if (!parsed.version || !Array.isArray(parsed.skills)) {
      throw new Error('Invalid skill market format: missing version or skills array')
    }

    const validSkills: SkillTemplate[] = []

    for (const skill of parsed.skills) {
      if (this.validateSkillSchema(skill)) {
        // Generate new ID for imported skill to avoid conflicts
        const importedSkill: SkillTemplate = {
          ...skill,
          id: `imported_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          isBuiltIn: false,
          useCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        validSkills.push(importedSkill)
      }
    }

    return validSkills
  }

  validateSkillSchema(obj: unknown): boolean {
    return isSkillTemplate(obj)
  }
}

// Factory function to create SkillMarket instance
export function createSkillMarket(
  getSkill: (id: string) => SkillTemplate | undefined,
  listSkills: () => SkillTemplate[]
): SkillMarket {
  return new SkillMarketImpl(getSkill, listSkills)
}

export const skillMarket = {
  validateSkillSchema(obj: unknown): boolean {
    return isSkillTemplate(obj)
  }
}
