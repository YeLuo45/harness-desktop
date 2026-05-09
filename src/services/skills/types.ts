/**
 * P10: Skill System - Skill Types
 * 
 * Types for reusable prompt templates and skill management.
 */

export type SkillCategory = 
  | 'coding'
  | 'debugging'
  | 'review'
  | 'planning'
  | 'research'
  | 'writing'
  | 'creative'
  | 'custom'

export interface SkillVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select'
  description: string
  required: boolean
  default?: string | number | boolean
  options?: string[]  // For select type
}

export interface SkillTemplate {
  id: string
  name: string
  description: string
  category: SkillCategory
  // Template with {{variable}} placeholders
  template: string
  // Variable definitions
  variables: SkillVariable[]
  // Metadata
  version: string
  author?: string
  tags: string[]
  // Usage tracking
  useCount: number
  lastUsedAt?: number
  createdAt: number
  updatedAt: number
  // Settings
  enabled: boolean
  isBuiltIn: boolean
}

export interface SkillExecution {
  skillId: string
  variables: Record<string, unknown>
  renderedPrompt: string
  executedAt: number
  durationMs?: number
}

export interface SkillRegistry {
  register(skill: SkillTemplate): void
  unregister(id: string): void
  get(id: string): SkillTemplate | undefined
  update(id: string, updates: Partial<SkillTemplate>): SkillTemplate | null
  list(category?: SkillCategory): SkillTemplate[]
  search(query: string): SkillTemplate[]
}

export interface SkillSearchQuery {
  name?: string
  category?: SkillCategory
  tags?: string[]
  query?: string  // Free text search
  enabled?: boolean
  limit?: number
  offset?: number
}

// Template rendering
export interface RenderOptions {
  strict?: boolean  // Throw on missing variable
  defaults?: boolean  // Use default values for missing
}

// Skill Version Management
export interface SkillVersion {
  version: string
  createdAt: number
  template: SkillTemplate
}

// Skill Chain for sequential execution
export interface SkillChain {
  id: string
  name: string
  skillIds: string[]
  onError: 'stop' | 'continue'
}

// Result of chain execution
export interface ChainResult {
  chainId: string
  results: Array<{ skillId: string; success: boolean; result?: unknown; error?: string }>
  totalDuration: number
}

// Built-in skill templates
export const BUILT_IN_SKILLS: Omit<SkillTemplate, 'id' | 'useCount' | 'lastUsedAt' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Code Review',
    description: 'Review code for bugs, performance issues, and best practices',
    category: 'review',
    template: `Please review the following code:

{{code}}

Focus on:
1. Potential bugs and edge cases
2. Performance issues
3. Security vulnerabilities
4. Code style and readability
5. Error handling`,
    variables: [
      { name: 'code', type: 'string', description: 'The code to review', required: true }
    ],
    version: '1.0.0',
    tags: ['code', 'review', 'quality'],
    enabled: true,
    isBuiltIn: true
  },
  {
    name: 'Explain Code',
    description: 'Explain what a piece of code does in simple terms',
    category: 'coding',
    template: `Explain the following code in simple terms:

{{code}}

Provide:
1. A brief summary of what the code does
2. Key components and their purpose
3. Any important patterns or techniques used`,
    variables: [
      { name: 'code', type: 'string', description: 'The code to explain', required: true }
    ],
    version: '1.0.0',
    tags: ['code', 'explain', 'documentation'],
    enabled: true,
    isBuiltIn: true
  },
  {
    name: 'Debug Assistant',
    description: 'Help debug a problem with detailed analysis',
    category: 'debugging',
    template: `Help me debug this issue:

Error/Bug Description:
{{error}}

Code:
{{code}}

Context:
{{context}}

Please provide:
1. Possible causes
2. Suggested fixes
3. Prevention tips`,
    variables: [
      { name: 'error', type: 'string', description: 'The error message or bug description', required: true },
      { name: 'code', type: 'string', description: 'Related code', required: false },
      { name: 'context', type: 'string', description: 'Additional context', required: false }
    ],
    version: '1.0.0',
    tags: ['debug', 'problem-solving'],
    enabled: true,
    isBuiltIn: true
  },
  {
    name: 'Test Generator',
    description: 'Generate unit tests for code',
    category: 'coding',
    template: `Generate unit tests for the following code:

{{code}}

Testing framework: {{framework}}
Style: {{style}}

Include tests for:
1. Happy path
2. Edge cases
3. Error conditions`,
    variables: [
      { name: 'code', type: 'string', description: 'The code to test', required: true },
      { name: 'framework', type: 'select', description: 'Testing framework', required: true, options: ['jest', 'vitest', 'pytest', 'junit', 'other'] },
      { name: 'style', type: 'select', description: 'Test style', required: false, options: ['AAA', 'BDD', 'TDD'], default: 'AAA' }
    ],
    version: '1.0.0',
    tags: ['testing', 'code-generation'],
    enabled: true,
    isBuiltIn: true
  },
  {
    name: 'Refactoring Plan',
    description: 'Plan a refactoring effort',
    category: 'planning',
    template: `Help me plan a refactoring for:

Target: {{target}}
Current Issues: {{issues}}
Goal: {{goal}}

Please provide:
1. Steps to refactor
2. Risks and mitigations
3. Testing strategy
4. Estimated effort`,
    variables: [
      { name: 'target', type: 'string', description: 'What to refactor', required: true },
      { name: 'issues', type: 'string', description: 'Current problems', required: true },
      { name: 'goal', type: 'string', description: 'Desired outcome', required: false, default: 'Improve code quality' }
    ],
    version: '1.0.0',
    tags: ['refactoring', 'planning'],
    enabled: true,
    isBuiltIn: true
  }
]