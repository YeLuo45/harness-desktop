/**
 * Hook System - Public API
 */

// Types
export {
  HookPhase,
  HookContext,
  HookResult,
  HookDefinition,
  HookRegistryConfig,
  HookExecutionSummary,
} from './types';

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
export function createHookHandler<T extends HookContext>(
  handler: (context: T) => Promise<HookResult> | HookResult
): (context: HookContext) => Promise<HookResult> | HookResult {
  return handler;
}

/**
 * Utility to compose multiple hooks into one
 */
export function composeHooks(...hooks: HookDefinition[]): HookDefinition[] {
  return hooks;
}
