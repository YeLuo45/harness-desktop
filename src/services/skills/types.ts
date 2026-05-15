/**
 * Skill System Type Definitions
 */

/** Skill manifest - the static declaration of a skill */
export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  tags?: string[];
  permissions?: string[];
  entryPoint: string;
  config?: Record<string, unknown>;
}

/** Runtime instance of a skill */
export interface SkillInstance {
  manifest: SkillManifest;
  enabled: boolean;
  instanceId: string;
  createdAt: number;
  updatedAt: number;
  config: Record<string, unknown>;
}

/** Skill execution context */
export interface SkillContext {
  instanceId: string;
  input: unknown;
  metadata?: Record<string, unknown>;
}

/** Skill execution result */
export interface SkillResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration?: number;
}

/** Skill runner options */
export interface SkillRunnerOptions {
  timeout?: number;
  retries?: number;
  onProgress?: (progress: number) => void;
}

/** Skill sync direction */
export type SyncDirection = 'pull' | 'push' | 'full';

/** Skill sync options */
export interface SyncOptions {
  direction: SyncDirection;
  remoteUrl?: string;
  force?: boolean;
}

/** Market listing for a skill */
export interface MarketListing {
  manifest: SkillManifest;
  downloads: number;
  rating: number;
  reviews: number;
}

/** Installation result */
export interface InstallResult {
  success: boolean;
  instanceId?: string;
  error?: string;
}

/** Skill category type */
export type SkillCategory = 'coding' | 'debugging' | 'review' | 'planning' | 'research' | 'writing' | 'creative' | 'custom';

/** Skill template - a reusable prompt template */
export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  version?: string;
  variables: Array<{
    name: string;
    description?: string;
    defaultValue?: unknown;
    required?: boolean;
  }>;
  category: SkillCategory;
  tags: string[];
  isBuiltIn?: boolean;
  enabled: boolean;
  useCount: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

/** Skill registry interface */
export interface SkillRegistry {
  register(skill: SkillTemplate): void;
  unregister(id: string): boolean;
  get(id: string): SkillTemplate | undefined;
  update(id: string, updates: Partial<SkillTemplate>): SkillTemplate | null;
  list(category?: SkillCategory): SkillTemplate[];
  search(query: SkillSearchQuery): SkillTemplate[];
  render(skillId: string, variables: Record<string, unknown>, options?: RenderOptions): string;
  execute(skillId: string, variables: Record<string, unknown>, options?: RenderOptions): Promise<SkillExecution>;
  getExecutionHistory(limit?: number): SkillExecution[];
  getByCategory(category: SkillCategory): SkillTemplate[];
  getPopular(limit?: number): SkillTemplate[];
  getRecent(limit?: number): SkillTemplate[];
  getCategories(): Record<SkillCategory, number>;
  getVersions(skillId: string): SkillVersion[];
  addVersion(skillId: string, version: string, template: SkillTemplate): void;
  deleteVersion?(skillId: string, version: string): boolean;
  setCurrentVersion?(skillId: string, version: string): boolean;
  getCurrentVersion?(skillId: string): string | undefined;
}

/** Skill search query */
export interface SkillSearchQuery {
  name?: string;
  query?: string;
  category?: SkillCategory;
  tags?: string[];
  enabled?: boolean;
  offset?: number;
  limit?: number;
}

/** Skill execution record */
export interface SkillExecution {
  skillId: string;
  variables: Record<string, unknown>;
  renderedPrompt: string;
  executedAt: number;
  durationMs: number;
}

/** Render options for template rendering */
export interface RenderOptions {
  partial?: boolean;
  includeMetadata?: boolean;
  defaults?: boolean;
  strict?: boolean;
}

/** Skill version info */
export interface SkillVersion {
  version: string;
  createdAt: number;
  template: SkillTemplate;
}

/** Built-in skills constant */
export const BUILT_IN_SKILLS: Omit<SkillTemplate, 'id' | 'createdAt' | 'updatedAt' | 'useCount' | 'lastUsedAt'>[] = [
  {
    name: 'Code Review',
    description: 'Review code for bugs, performance issues, and best practices',
    template: 'Please review this code:\n\n{{code}}\n\nFocus on:\n1. Bug detection\n2. Performance issues\n3. Security vulnerabilities\n4. Code style',
    variables: [
      { name: 'code', description: 'The code to review', required: true }
    ],
    category: 'review',
    tags: ['code', 'review', 'quality'],
    isBuiltIn: true,
    enabled: true,
  },
  {
    name: 'Debug Assistant',
    description: 'Help debug code and find issues',
    template: 'Debug this code:\n\n{{code}}\n\nError message:\n{{error}}\n\nWhat is the issue and how can I fix it?',
    variables: [
      { name: 'code', description: 'The buggy code', required: true },
      { name: 'error', description: 'The error message', required: false }
    ],
    category: 'debugging',
    tags: ['debug', 'error', 'fix'],
    isBuiltIn: true,
    enabled: true,
  },
  {
    name: 'Code Generator',
    description: 'Generate code from specifications',
    template: 'Generate {{language}} code for:\n\n{{specification}}',
    variables: [
      { name: 'language', description: 'Programming language', defaultValue: 'TypeScript', required: true },
      { name: 'specification', description: 'What the code should do', required: true }
    ],
    category: 'coding',
    tags: ['code', 'generator', 'create'],
    isBuiltIn: true,
    enabled: true,
  }
];
