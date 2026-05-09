/**
 * P10: Skill System - Skills Module
 * 
 * Export all skill types and utilities.
 */

export {
  type SkillTemplate,
  type SkillVariable,
  type SkillExecution,
  type SkillRegistry,
  type SkillSearchQuery,
  type RenderOptions,
  type SkillCategory,
  BUILT_IN_SKILLS
} from './types'

export { SkillManager, skillManager } from './skillManager'