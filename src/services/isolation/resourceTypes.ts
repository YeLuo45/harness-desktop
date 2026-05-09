// Resource Isolation Types

export enum ResourceType {
  MEMORY = 'memory',
  CPU = 'cpu',
  TIME = 'time',
  FILE_SIZE = 'file_size',
  NETWORK = 'network'
}

export interface ResourceQuota {
  memoryMB: number
  cpuTimeMs: number
  maxExecTimeMs: number
  maxFileSizeMB: number
  maxNetworkCalls: number
}

export interface ResourceUsage {
  memoryUsedMB: number
  cpuTimeUsedMs: number
  execTimeUsedMs: number
  fileSizeUsedMB: number
  networkCalls: number
  timestamp: number
}

export interface ExecutionContext {
  id: string
  agentId: string
  createdAt: number
  isActive: boolean
  usage: ResourceUsage
}

export interface SandboxConfig {
  enableNetworkIsolation: boolean
  allowFileSystem: boolean
  allowedPaths: string[]
  blockedSyscalls: string[]
  maxMemoryMB: number
  maxCpuTimeMs: number
  timeoutMs: number
}

export enum SandboxResultStatus {
  SUCCESS = 'success',
  TIMEOUT = 'timeout',
  MEMORY_EXCEEDED = 'memory_exceeded',
  CPU_EXCEEDED = 'cpu_exceeded',
  SECURITY_VIOLATION = 'security_violation',
  ERROR = 'error'
}

export interface SandboxResult {
  status: SandboxResultStatus
  output?: string
  error?: string
  executionTimeMs: number
  memoryUsedMB: number
  cpuTimeMs: number
}

export interface ResourceAlert {
  id: string
  type: ResourceType
  severity: 'warning' | 'critical'
  agentId: string
  message: string
  currentValue: number
  threshold: number
  timestamp: number
}

export interface ResourceStats {
  totalAgents: number
  activeAgents: number
  totalMemoryUsedMB: number
  totalCpuTimeUsedMs: number
  avgMemoryUsagePercent: number
  avgCpuUsagePercent: number
}

export const DEFAULT_RESOURCE_QUOTA: ResourceQuota = {
  memoryMB: 512,
  cpuTimeMs: 60000,
  maxExecTimeMs: 300000,
  maxFileSizeMB: 100,
  maxNetworkCalls: 1000
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  enableNetworkIsolation: true,
  allowFileSystem: false,
  allowedPaths: [],
  blockedSyscalls: ['exec', 'fork', 'kill', 'system'],
  maxMemoryMB: 256,
  maxCpuTimeMs: 30000,
  timeoutMs: 60000
}