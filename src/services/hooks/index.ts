/**
 * Hook System - Public API
 */

// Types - import locally to use in this file, then re-export
import type {
  HookContext,
  HookResult,
  HookDefinition,
  HookRegistryConfig,
  HookExecutionSummary,
} from './types';

export { HookPhase } from './types';
export type {
  HookContext,
  HookResult,
  HookDefinition,
  HookRegistryConfig,
  HookExecutionSummary,
};

// Registry
export {
  HookRegistry,
  getRegistry,
  setRegistry,
} from './hookRegistry';

// Built-in hooks
export * from './builtin/safety';
export * from './builtin/rateLimit';
export * from './builtin/validation';

/**
 * Create a simple hook handler function
 */
export function createHookHandler(
  handler: (context: HookContext) => Promise<HookResult> | HookResult
): (context: HookContext) => Promise<HookResult> | HookResult {
  return handler;
}

/**
 * Utility to compose multiple hooks into one
 */
export function composeHooks(...hooks: HookDefinition[]): HookDefinition[] {
  return hooks;
}
