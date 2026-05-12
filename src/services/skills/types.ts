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
