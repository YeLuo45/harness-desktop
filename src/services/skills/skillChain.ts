/**
 * P10: Skill System - Skill Chain
 * 
 * Execute multiple skills in sequence with error handling.
 */

import type { SkillTemplate } from './types'

export interface SkillChain {
  id: string
  name: string
  skills: string[]  // Skill IDs
  onError: 'stop' | 'continue'
}

export interface SkillChainResult {
  skillId: string
  success: boolean
  result?: unknown
  error?: string
}

export interface ChainResult {
  chainId: string
  results: SkillChainResult[]
  totalDuration: number
}

export class SkillChainExecutor {
  constructor(
    private getSkill: (id: string) => SkillTemplate | undefined,
    private renderSkill: (skillId: string, variables: Record<string, unknown>) => string
  ) {}

  async execute(chain: SkillChain, context: Record<string, unknown>): Promise<ChainResult> {
    const startTime = Date.now()
    const results: SkillChainResult[] = []

    for (const skillId of chain.skills) {
      try {
        const result = await this.executeSkill(skillId, context)
        results.push({
          skillId,
          success: true,
          result
        })
      } catch (error) {
        // onError='stop' means stop immediately without recording the failure
        if (chain.onError === 'stop') {
          break
        }
        // onError='continue' means record the failure and continue
        const errorMessage = error instanceof Error ? error.message : String(error)
        results.push({
          skillId,
          success: false,
          error: errorMessage
        })
      }
    }

    return {
      chainId: chain.id,
      results,
      totalDuration: Date.now() - startTime
    }
  }

  async executeSkill(skillId: string, context: Record<string, unknown>): Promise<unknown> {
    const skill = this.getSkill(skillId)
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`)
    }

    // Render the skill template with context variables
    const rendered = this.renderSkill(skillId, context)
    return {
      skillId,
      rendered,
      timestamp: Date.now()
    }
  }
}

// Helper to create a new skill chain
export function createSkillChain(
  id: string,
  name: string,
  skillIds: string[],
  onError: 'stop' | 'continue' = 'stop'
): SkillChain {
  return {
    id,
    name,
    skills: skillIds,
    onError
  }
}

// Factory function to create executor
export function createSkillChainExecutor(
  getSkill: (id: string) => SkillTemplate | undefined,
  renderSkill: (skillId: string, variables: Record<string, unknown>) => string
): SkillChainExecutor {
  return new SkillChainExecutor(getSkill, renderSkill)
}
