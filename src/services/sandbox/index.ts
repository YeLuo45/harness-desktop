/**
 * Sandbox Module - Unified Export
 */

// Types
export type {
  SandboxConfig,
  SandboxResult,
  AuditEntry,
  AuditEventType,
  ProcessIsolatorConfig,
  FileIsolatorConfig,
  NetworkIsolatorConfig,
  ExecutionContext,
} from './types';

// Isolators
export { ProcessIsolator } from './processIsolator';
export { FileIsolator } from './fileIsolator';
export { NetworkIsolator } from './networkIsolator';
export { AuditLogger } from './auditLogger';

// Manager
export { SandboxManager, createSandbox } from './sandboxManager';
