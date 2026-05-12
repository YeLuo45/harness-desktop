/**
 * Sandbox Type Definitions
 */

export type Language = 'python' | 'javascript' | 'shell';

export type SandboxStatus = 'created' | 'running' | 'paused' | 'stopped' | 'error';

export interface SandboxConfig {
  id: string;
  name: string;
  timeout: number; // milliseconds
  memoryLimit: number; // MB
  diskLimit: number; // MB
  networkEnabled: boolean;
  allowedDomains: string[];
  maxProcesses: number;
  env?: Record<string, string>;
}

export interface ExecutionResult {
  id: string;
  sandboxId: string;
  language: Language;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  duration: number; // milliseconds
  startTime: Date;
  endTime: Date | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  error?: string;
}

export interface CodeExecution {
  code: string;
  language: Language;
  files?: Record<string, string>; // filename -> content for multi-file
  stdin?: string;
  timeout?: number;
  workingDir?: string;
}

export interface Snapshot {
  id: string;
  sandboxId: string;
  name: string;
  createdAt: Date;
  size: number; // bytes
  checksum: string;
}

export interface FileEntry {
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  permissions: string;
  content?: string;
  children?: FileEntry[];
  modifiedAt: Date;
  createdAt: Date;
}

export interface NetworkRequest {
  id: string;
  sandboxId: string;
  domain: string;
  ip: string;
  port: number;
  protocol: 'http' | 'https' | 'tcp' | 'udp';
  allowed: boolean;
  timestamp: Date;
}

export interface SandboxStats {
  sandboxId: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkBytesIn: number;
  networkBytesOut: number;
  processCount: number;
}
