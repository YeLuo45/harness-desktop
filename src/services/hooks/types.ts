/**
 * Hook System Type Definitions
 */

/** Hook execution phases */
export enum HookPhase {
  BEFORE = 'before',
  AFTER = 'after',
  ON_ERROR = 'on_error',
}

/** Context passed to every hook execution */
export interface HookContext {
  /** Unique request/operation identifier */
  id: string;
  /** Operation name (e.g., 'file:read', 'command:execute') */
  operation: string;
  /** Target resource path or identifier */
  resource?: string;
  /** Operation parameters */
  params?: Record<string, unknown>;
  /** Current phase */
  phase: HookPhase;
  /** Timestamp when hook chain started */
  timestamp: number;
  /** Metadata store for hooks to pass data */
  metadata: Record<string, unknown>;
}

/** Result returned by hook execution */
export interface HookResult {
  /** Whether operation should proceed */
  allowed: boolean;
  /** Error message if rejected */
  error?: string;
  /** Modified or additional data to return */
  data?: unknown;
  /** Optional delay (ms) for rate limiting */
  delay?: number;
}

/** Single hook definition */
export interface HookDefinition {
  /** Unique hook identifier */
  name: string;
  /** Operations this hook applies to (glob patterns supported) */
  operations: string[];
  /** Execution phase */
  phase: HookPhase;
  /** Priority (higher = executed first) */
  priority: number;
  /** Async hook handler */
  handler: (context: HookContext) => Promise<HookResult> | HookResult;
  /** Whether to continue chain on error */
  continueOnError?: boolean;
  /** Optional configuration */
  config?: Record<string, unknown>;
}

/** Registry configuration */
export interface HookRegistryConfig {
  /** Default priority if not specified */
  defaultPriority?: number;
  /** Continue chain on unhandled errors */
  continueOnError?: boolean;
}

/** Hook execution summary */
export interface HookExecutionSummary {
  hookName: string;
  phase: HookPhase;
  duration: number;
  allowed: boolean;
  error?: string;
}
