/**
 * Skill System - Unified Export
 */

// Types
export * from './types';

// Core components
export { SkillRegistry, registry } from './skillRegistry';
export { SkillRunner, runner } from './skillRunner';
export { SkillSync, sync } from './skillSync';
export { SkillMarket, market } from './skillMarket';

// Built-in skills
export { fileOpsManifest } from './builtin/fileOps';
export { webSearchManifest, type SearchResult } from './builtin/webSearch';
export { codeGenManifest, type CodeGenOptions } from './builtin/codeGen';
