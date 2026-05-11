/**
 * Sandbox Types and Interfaces
 */

export interface SandboxConfig {
  /** Maximum execution time in milliseconds */
  timeout: number;
  /** Maximum memory in bytes */
  memoryLimit?: number;
  /** Maximum CPU percentage (0-100) */
  cpuLimit?: number;
  /** Allowed directories for file operations (whitelist) */
  allowedPaths?: string[];
  /** Blocked directories for file operations (blacklist) */
  blockedPaths?: string[];
  /** Allow network access */
  allowNetwork?: boolean;
  /** DNS servers to use (for DNS pollution prevention) */
  dnsServers?: string[];
  /** Working directory for the sandbox */
  workingDirectory?: string;
  /** Environment variables to pass */
  env?: Record<string, string>;
}

export interface SandboxResult {
  /** Exit code of the process */
  exitCode: number | null;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Whether the execution was killed due to timeout */
  killed: boolean;
  /** Signal that killed the process (if applicable) */
  signal?: string;
  /** Memory usage peak in bytes */
  memoryUsage?: number;
  /** Audit trail entries */
  auditEntries: AuditEntry[];
}

export interface AuditEntry {
  /** Timestamp of the event */
  timestamp: string;
  /** Event type */
  event: AuditEventType;
  /** Event details */
  details: string;
  /** Resource consumed (if applicable) */
  resourceUsage?: {
    memory?: number;
    cpu?: number;
    duration?: number;
  };
}

export type AuditEventType =
  | 'PROCESS_START'
  | 'PROCESS_EXIT'
  | 'PROCESS_KILLED'
  | 'FILE_ACCESS_ALLOWED'
  | 'FILE_ACCESS_DENIED'
  | 'NETWORK_ALLOWED'
  | 'NETWORK_DENIED'
  | 'RESOURCE_LIMIT_EXCEEDED'
  | 'TIMEOUT_EXCEEDED';

export interface ProcessIsolatorConfig {
  timeout: number;
  memoryLimit?: number;
  cpuLimit?: number;
  workingDirectory?: string;
  env?: Record<string, string>;
}

export interface FileIsolatorConfig {
  allowedPaths?: string[];
  blockedPaths?: string[];
  workingDirectory?: string;
}

export interface NetworkIsolatorConfig {
  allowNetwork: boolean;
  dnsServers?: string[];
}

export interface ExecutionContext {
  pid: number;
  startTime: number;
  spawn: (cmd: string, args: string[], options: any) => any;
  kill: (signal?: string) => void;
}
