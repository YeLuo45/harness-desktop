/**
 * Hook Registry - Manages hook registration and execution
 */

import {
  HookPhase,
  HookContext,
  HookResult,
  HookDefinition,
  HookRegistryConfig,
  HookExecutionSummary,
} from './types';

export class HookRegistry {
  private hooks: Map<string, HookDefinition[]> = new Map();
  private config: Required<HookRegistryConfig>;

  constructor(config: HookRegistryConfig = {}) {
    this.config = {
      defaultPriority: config.defaultPriority ?? 100,
      continueOnError: config.continueOnError ?? false,
    };
  }

  /**
   * Register a hook definition
   */
  register(hook: HookDefinition): void {
    for (const operation of hook.operations) {
      if (!this.hooks.has(operation)) {
        this.hooks.set(operation, []);
      }
      const ops = this.hooks.get(operation)!;
      ops.push({
        ...hook,
        priority: hook.priority ?? this.config.defaultPriority,
      });
      // Sort by priority descending
      ops.sort((a, b) => b.priority - a.priority);
    }
  }

  /**
   * Unregister a hook by name
   */
  unregister(name: string): boolean {
    let found = false;
    const keys = Array.from(this.hooks.keys());
    for (const key of keys) {
      const hooks = this.hooks.get(key)!;
      const idx = hooks.findIndex((h) => h.name === name);
      if (idx !== -1) {
        hooks.splice(idx, 1);
        found = true;
      }
    }
    return found;
  }

  /**
   * Clear all hooks for an operation
   */
  clear(operation?: string): void {
    if (operation) {
      this.hooks.delete(operation);
    } else {
      this.hooks.clear();
    }
  }

  /**
   * Execute hooks for an operation
   */
  async execute(
    operation: string,
    partialContext: Partial<HookContext>
  ): Promise<{ context: HookContext; results: HookExecutionSummary[] }> {
    const context: HookContext = {
      id: partialContext.id ?? crypto.randomUUID(),
      operation,
      resource: partialContext.resource,
      params: partialContext.params,
      phase: partialContext.phase ?? HookPhase.BEFORE,
      timestamp: partialContext.timestamp ?? Date.now(),
      metadata: partialContext.metadata ?? {},
    };

    const results: HookExecutionSummary[] = [];
    const ops = this.hooks.get(operation) ?? [];

    for (const hook of ops) {
      // Update phase on context
      context.phase = hook.phase;

      const start = Date.now();
      try {
        const result = await Promise.resolve(hook.handler(context));
        const duration = Date.now() - start;

        results.push({
          hookName: hook.name,
          phase: hook.phase,
          duration,
          allowed: result.allowed,
          error: result.error,
        });

        if (!result.allowed) {
          return { context, results };
        }

        // Allow hook to modify context metadata
        if (result.data !== undefined) {
          context.metadata[hook.name] = result.data;
        }
      } catch (error) {
        const duration = Date.now() - start;
        results.push({
          hookName: hook.name,
          phase: hook.phase,
          duration,
          allowed: false,
          error: error instanceof Error ? error.message : String(error),
        });

        if (!hook.continueOnError && !this.config.continueOnError) {
          return { context, results };
        }
      }
    }

    return { context, results };
  }

  /**
   * Get all registered hook names
   */
  listHooks(): string[] {
    const names = new Set<string>();
    const keys = Array.from(this.hooks.keys());
    for (const key of keys) {
      const hooks = this.hooks.get(key)!;
      for (const hook of hooks) {
        names.add(hook.name);
      }
    }
    return Array.from(names);
  }

  /**
   * Get hooks for a specific operation
   */
  getHooks(operation: string): HookDefinition[] {
    return this.hooks.get(operation) ?? [];
  }
}

// Default registry instance
let defaultRegistry: HookRegistry | null = null;

export function getRegistry(): HookRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new HookRegistry();
  }
  return defaultRegistry;
}

export function setRegistry(registry: HookRegistry): void {
  defaultRegistry = registry;
}
