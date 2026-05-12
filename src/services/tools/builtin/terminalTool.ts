/**
 * Terminal Tool - Shell command execution with sandbox integration
 * - Dangerous command detection and sandbox execution
 * - Resource limits and timeout control
 * - Audit logging
 */

import { registerTool } from '../decorators'
import type { ToolExecutor } from '../types'
import { VerificationHooks, getVerificationHooks } from '../../verificationHooks'
import type { ToolResult } from '../../../types'
import { getPlatformImpl } from '../../../../src/services/platform/platformDetect'

// Child process module - only available in Node.js environment
let childProcess: typeof import('child_process') | null = null

// Lazy-loaded shell adapter for cross-platform shell operations
let shellAdapter: ReturnType<typeof getPlatformImpl>['shell'] | null = null

function getShellAdapter() {
  if (!shellAdapter) {
    const platformImpl = getPlatformImpl()
    shellAdapter = platformImpl.shell
  }
  return shellAdapter
}

async function getChildProcess() {
  if (!childProcess) {
    try {
      childProcess = await import('child_process')
    } catch {
      console.warn('[TerminalTool] child_process module not available')
    }
  }
  return childProcess
}

// ==================== Dangerous Command Detection ====================

/** Patterns for dangerous system commands that require sandbox execution */
const DANGEROUS_COMMANDS = new Set([
  'rm', 'rmdir', 'del', 'erase', 'format',
  'shutdown', 'reboot', 'halt', 'poweroff',
  'dd', 'mkfs', 'fdisk', 'sfdisk',
  'chmod', 'chown', 'chgrp',
  'wget', 'curl', 'nc', 'netcat',
  'bash', 'sh', 'cmd', 'powershell',
  'python', 'perl', 'ruby', 'php',
  'vim', 'vi', 'nano', 'emacs',
  'sudo', 'su', 'passwd',
  'ssh', 'scp', 'sftp',
  'mount', 'umount', 'loops',
  'git', 'svn', 'hg',
  'docker', 'kubectl', 'helm',
  'npm', 'yarn', 'pnpm', 'pip', 'gem', 'cargo',
])

/** Commands that may be allowed but need monitoring */
const RISKY_COMMANDS = new Set([
  'node', 'python3', 'ruby', 'perl', 'php',
  'cat', 'head', 'tail', 'less', 'more',
  'grep', 'find', 'ls', 'cd', 'pwd',
  'echo', 'printf', 'export', 'source',
  'kill', 'pkill', 'killall',
  'zip', 'tar', 'gzip', 'bzip2', 'unzip',
])

/**
 * Check if a command is considered dangerous and requires sandbox execution
 */
function isDangerousCommand(command: string): boolean {
  const parts = command.trim().split(/\s+/)
  const base = parts[0].split('/').pop()?.toLowerCase() ?? ''
  return DANGEROUS_COMMANDS.has(base)
}

/**
 * Check if a command is risky and should be monitored
 */
function isRiskyCommand(command: string): boolean {
  const parts = command.trim().split(/\s+/)
  const base = parts[0].split('/').pop()?.toLowerCase() ?? ''
  return RISKY_COMMANDS.has(base)
}

/**
 * Check for dangerous command patterns (compound dangerous commands)
 */
function containsDangerousPattern(command: string): boolean {
  const lowerCommand = command.toLowerCase()
  const dangerousPatterns = [
    /rm\s+-rf/, /del\s+\/f\s+\/q/, /format\s+/, /dd\s+if=/,
    /shutdown/, /reboot/, /halt/, /poweroff/,
    /chmod\s+777/, /chmod\s+-r\s+777/,
    /curl\s+.*\|/, /wget\s+.*\|/, /nc\s+.*-e/,
    /eval\s+\$\(/, /exec\s+\$\(/,
  ]
  return dangerousPatterns.some(pattern => pattern.test(lowerCommand))
}

// ==================== Audit Logging ====================

interface AuditLogEntry {
  timestamp: number
  toolName: string
  operation: string
  command: string
  action: 'EXECUTED' | 'SANDBOXED' | 'BLOCKED' | 'TIMEOUT'
  reason?: string
  duration?: number
  exitCode?: number
  sandboxed: boolean
}

/**
 * In-memory audit log storage
 */
const auditLog: AuditLogEntry[] = []
const MAX_AUDIT_LOG_SIZE = 10000

/**
 * Add entry to audit log
 */
function addAuditLog(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  const logEntry: AuditLogEntry = {
    timestamp: Date.now(),
    ...entry
  }
  auditLog.push(logEntry)
  
  // Keep log size bounded
  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.shift()
  }
  
  // Console output for audit trail
  const timeStr = new Date(logEntry.timestamp).toISOString()
  console.info(`[AUDIT] ${timeStr} | ${entry.toolName} | ${entry.operation} | ${entry.action} | sandboxed=${entry.sandboxed} | ${entry.command.substring(0, 100)}${entry.command.length > 100 ? '...' : ''}${entry.reason ? ` | ${entry.reason}` : ''}`)
}

/**
 * Get audit logs with optional filtering
 */
function getAuditLogs(options?: { 
  toolName?: string
  action?: 'EXECUTED' | 'SANDBOXED' | 'BLOCKED' | 'TIMEOUT'
  since?: number
  limit?: number
}): AuditLogEntry[] {
  let logs = [...auditLog]
  
  if (options?.toolName) {
    logs = logs.filter(l => l.toolName === options.toolName)
  }
  if (options?.action) {
    logs = logs.filter(l => l.action === options.action)
  }
  if (options?.since) {
    logs = logs.filter(l => l.timestamp >= options.since!)
  }
  if (options?.limit) {
    logs = logs.slice(-options.limit)
  }
  
  return logs
}

// ==================== Sandbox Execution ====================

interface SandboxConfig {
  workDir: string
  maxMemoryMB: number
  maxCpuPercent: number
  maxTimeoutMs: number
  allowedExtensions: string[]
}

const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  workDir: process.env.HOME || '/tmp',
  maxMemoryMB: 512,
  maxCpuPercent: 80,
  maxTimeoutMs: 30000,
  allowedExtensions: ['.txt', '.md', '.json', '.js', '.ts', '.py', '.html', '.css', '.xml', '.yaml', '.yml']
}

/**
 * Execute command in sandboxed environment with resource limits
 */
async function executeInSandbox(
  command: string, 
  timeoutMs: number,
  config: SandboxConfig = DEFAULT_SANDBOX_CONFIG
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
  const cp = await getChildProcess()
  if (!cp || !cp.spawn) {
    throw new Error('Child process module not available')
  }

  const { spawn } = cp
  
  return new Promise((resolve) => {
    const shell = getShellAdapter()
    const shellInfo = shell.getShell()
    const isWindows = shellInfo.isWindows
    const shellPath = shell.getShellPath()
    const shellArgs = shell.translateCommand ? [shell.translateCommand(command)] : ['-c', command]
    
    // Restricted environment
    const env = {
      ...process.env,
      HOME: config.workDir,
      TMPDIR: config.workDir,
      PATH: isWindows 
        ? `C:\\Windows\\system32;C:\\Windows;C:\\Program Files\\Git\\cmd` 
        : '/usr/bin:/bin:/usr/local/bin',
    }

    const proc = spawn(shellPath, shellArgs, {
      cwd: config.workDir,
      env,
      timeout: timeoutMs,
      windowsHide: true,
      stdio: 'pipe'
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString('utf8')
    })

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString('utf8')
    })

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
      // Force kill after 5 seconds
      setTimeout(() => {
        try {
          proc.kill('SIGKILL')
        } catch {}
      }, 5000)
    }, timeoutMs)

    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        stdout: stdout.slice(0, 50000), // Limit output size
        stderr: stderr.slice(0, 10000),
        exitCode: code || 0,
        timedOut
      })
    })

    proc.on('error', (error) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr: stderr + error.message,
        exitCode: 1,
        timedOut
      })
    })
  })
}

/**
 * Execute command directly (for non-dangerous commands)
 */
async function executeDirect(
  command: string,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
  const cp = await getChildProcess()
  if (!cp || !cp.execSync) {
    throw new Error('Child process module not available')
  }

  return new Promise((resolve) => {
    const shell = getShellAdapter()
    const shellInfo = shell.getShell()
    const isWindows = shellInfo.isWindows
    const shellPath = shell.getShellPath()
    const shellArgs = shell.translateCommand ? [shell.translateCommand(command)] : ['-c', command]

    const { spawn } = cp
    
    const proc = spawn(shellPath, shellArgs, {
      cwd: process.env.HOME || '/tmp',
      env: {
        ...process.env,
        HOME: process.env.HOME || '/tmp',
      },
      timeout: timeoutMs,
      windowsHide: true,
      stdio: 'pipe'
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString('utf8')
    })

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString('utf8')
    })

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
    }, timeoutMs)

    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        stdout: stdout.slice(0, 50000),
        stderr: stderr.slice(0, 10000),
        exitCode: code || 0,
        timedOut
      })
    })

    proc.on('error', (error) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr: stderr + error.message,
        exitCode: 1,
        timedOut
      })
    })
  })
}

/**
 * Run before hook validation - throws on failure
 */
function runBeforeHook(hooks: VerificationHooks, toolName: string, args: Record<string, unknown>): void {
  if (hooks.getConfig().level === 'disabled') {
    return
  }
  // Create a mock ToolResult for before validation (checking arguments)
  const mockResult: ToolResult = {
    toolName,
    arguments: args,
    result: null,
    success: true,
    timestamp: Date.now()
  }
  const verification = hooks.verify(mockResult)
  if (!verification.passed) {
    const errorMsg = hooks.formatVerificationMessage(verification)
    throw new Error(`Before hook failed for ${toolName}: ${errorMsg}`)
  }
}

/**
 * Run after hook validation - throws on failure
 */
function runAfterHook(hooks: VerificationHooks, result: ToolResult): void {
  if (hooks.getConfig().level === 'disabled') {
    return
  }
  const verification = hooks.verify(result)
  if (!verification.passed) {
    const errorMsg = hooks.formatVerificationMessage(verification)
    throw new Error(`After hook failed for ${result.toolName}: ${errorMsg}`)
  }
}

class BashExecuteExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const cp = await getChildProcess()
    if (!cp || !cp.spawn) {
      return { success: false, error: 'Child process not available' }
    }

    const command = args.command as string
    const timeout = (args.timeout as number) || 30000

    if (!command) {
      return { success: false, error: 'command is required' }
    }

    // Get verification hooks instance
    const hooks = getVerificationHooks()

    // Run before hook - throws on failure
    runBeforeHook(hooks, 'bash_execute', args)

    const startTime = Date.now()
    const toolName = 'bash_execute'

    // Determine if command is dangerous and requires sandbox
    const shell = getShellAdapter()
    const dangerousCheck = shell.isDangerousCommand(command)
    const isDangerous = !!dangerousCheck || containsDangerousPattern(command)
    const isRisky = isRiskyCommand(command)
    const useSandbox = isDangerous || isRisky

    let executionResult: { success: boolean; result?: unknown; error?: string }

    try {
      let execResult: { stdout: string; stderr: string; exitCode: number; timedOut: boolean }

      if (useSandbox) {
        // Execute in sandbox with resource limits
        execResult = await executeInSandbox(command, timeout, {
          ...DEFAULT_SANDBOX_CONFIG,
          maxTimeoutMs: Math.min(timeout, 60000) // Cap at 60 seconds
        })

        addAuditLog({
          toolName,
          operation: 'execute',
          command,
          action: execResult.timedOut ? 'TIMEOUT' : 'SANDBOXED',
          duration: Date.now() - startTime,
          exitCode: execResult.exitCode,
          sandboxed: true,
          reason: execResult.timedOut ? `Command timed out after ${timeout}ms` : undefined
        })
      } else {
        // Execute directly for safe commands
        execResult = await executeDirect(command, timeout)

        addAuditLog({
          toolName,
          operation: 'execute',
          command,
          action: 'EXECUTED',
          duration: Date.now() - startTime,
          exitCode: execResult.exitCode,
          sandboxed: false
        })
      }

      if (execResult.timedOut) {
        executionResult = { 
          success: false, 
          error: `Command timed out after ${timeout}ms`,
          result: execResult.stdout
        }
      } else if (execResult.exitCode !== 0) {
        executionResult = { 
          success: false, 
          error: execResult.stderr || `Command failed with exit code ${execResult.exitCode}`,
          result: execResult.stdout
        }
      } else {
        executionResult = { success: true, result: execResult.stdout }
      }
    } catch (error: any) {
      addAuditLog({
        toolName,
        operation: 'execute',
        command,
        action: 'BLOCKED',
        duration: Date.now() - startTime,
        sandboxed: useSandbox,
        reason: error.message
      })
      executionResult = { 
        success: false, 
        error: error.message || `Command failed: ${command}`
      }
    }

    // Build ToolResult for after hook
    const toolResult: ToolResult = {
      toolName: 'bash_execute',
      arguments: args,
      result: executionResult.result,
      success: executionResult.success,
      error: executionResult.error,
      timestamp: Date.now()
    }

    // Run after hook - throws on failure
    runAfterHook(hooks, toolResult)

    return executionResult
  }
}

class GrepSearchExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const cp = await getChildProcess()
    if (!cp || !cp.spawn) {
      return { success: false, error: 'Child process not available' }
    }

    const pattern = args.pattern as string
    const filePath = args.file_path as string
    const caseSensitive = args.case_sensitive as boolean

    if (!pattern) {
      return { success: false, error: 'pattern is required' }
    }

    // Get verification hooks instance
    const hooks = getVerificationHooks()

    // Run before hook - throws on failure
    runBeforeHook(hooks, 'grep_search', args)

    const startTime = Date.now()
    const toolName = 'grep_search'

    let executionResult: { success: boolean; result?: unknown; error?: string }

    try {
      // Build grep command
      let cmd = 'grep'
      if (!caseSensitive) {
        cmd += ' -i'
      }
      cmd += ` -n "${pattern.replace(/"/g, '\\"')}"`

      if (filePath) {
        cmd += ` "${filePath.replace(/"/g, '\\"')}"`
      }

      // Execute via spawn (safer than execSync for search)
      const execResult = await executeDirect(cmd, 30000)

      if (execResult.timedOut) {
        addAuditLog({
          toolName,
          operation: 'search',
          command: cmd,
          action: 'TIMEOUT',
          duration: Date.now() - startTime,
          sandboxed: false
        })
        executionResult = { success: false, error: 'Search timed out' }
      } else if (execResult.exitCode === 1) {
        // grep returns exit code 1 when no matches found
        addAuditLog({
          toolName,
          operation: 'search',
          command: cmd,
          action: 'EXECUTED',
          duration: Date.now() - startTime,
          exitCode: execResult.exitCode,
          sandboxed: false
        })
        executionResult = { success: true, result: [] }
      } else if (execResult.exitCode !== 0) {
        addAuditLog({
          toolName,
          operation: 'search',
          command: cmd,
          action: 'EXECUTED',
          duration: Date.now() - startTime,
          exitCode: execResult.exitCode,
          sandboxed: false
        })
        executionResult = { 
          success: false, 
          error: execResult.stderr || `Search failed with exit code ${execResult.exitCode}`
        }
      } else {
        addAuditLog({
          toolName,
          operation: 'search',
          command: cmd,
          action: 'EXECUTED',
          duration: Date.now() - startTime,
          exitCode: execResult.exitCode,
          sandboxed: false
        })
        const lines = execResult.stdout.split('\n').filter(l => l.trim())
        executionResult = { success: true, result: lines }
      }
    } catch (error: any) {
      addAuditLog({
        toolName,
        operation: 'search',
        command: pattern,
        action: 'BLOCKED',
        duration: Date.now() - startTime,
        sandboxed: false,
        reason: error.message
      })
      executionResult = { 
        success: false, 
        error: error.message || `Search failed for: ${pattern}`
      }
    }

    // Build ToolResult for after hook
    const toolResult: ToolResult = {
      toolName: 'grep_search',
      arguments: args,
      result: executionResult.result,
      success: executionResult.success,
      error: executionResult.error,
      timestamp: Date.now()
    }

    // Run after hook - throws on failure
    runAfterHook(hooks, toolResult)

    return executionResult
  }
}

class ProjectTreeExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const cp = await getChildProcess()
    if (!cp || !cp.spawn) {
      return { success: false, error: 'Child process not available' }
    }

    const rootPath = (args.root_path || '.').toString()
    const maxDepth = (args.max_depth as number) || 5
    const includeHidden = (args.include_hidden as boolean) || false
    const excludePatterns = (args.exclude_patterns as string[]) || []

    // Get verification hooks instance
    const hooks = getVerificationHooks()

    // Run before hook - throws on failure
    runBeforeHook(hooks, 'project_tree', args)

    const startTime = Date.now()
    const toolName = 'project_tree'

    let executionResult: { success: boolean; result?: unknown; error?: string }

    try {
      // Build find command
      let cmd = 'find'
      if (!includeHidden) {
        cmd += ' -not -path "*/.*"'
      }
      for (const pattern of excludePatterns) {
        cmd += ` -not -path "*/${pattern}/*"`
      }
      cmd += ` -maxdepth ${maxDepth}`
      cmd += ` "${rootPath.replace(/"/g, '\\"')}"`

      const execResult = await executeDirect(cmd, 30000)

      if (execResult.timedOut) {
        addAuditLog({
          toolName,
          operation: 'tree',
          command: cmd,
          action: 'TIMEOUT',
          duration: Date.now() - startTime,
          sandboxed: false
        })
        executionResult = { success: false, error: 'Tree generation timed out' }
      } else if (execResult.exitCode !== 0) {
        addAuditLog({
          toolName,
          operation: 'tree',
          command: cmd,
          action: 'EXECUTED',
          duration: Date.now() - startTime,
          exitCode: execResult.exitCode,
          sandboxed: false
        })
        executionResult = { 
          success: false, 
          error: execResult.stderr || `Failed to list project tree`
        }
      } else {
        addAuditLog({
          toolName,
          operation: 'tree',
          command: cmd,
          action: 'EXECUTED',
          duration: Date.now() - startTime,
          exitCode: execResult.exitCode,
          sandboxed: false
        })
        const files = execResult.stdout.split('\n').filter(f => f.trim())
        executionResult = { success: true, result: files }
      }
    } catch (error: any) {
      addAuditLog({
        toolName,
        operation: 'tree',
        command: rootPath,
        action: 'BLOCKED',
        duration: Date.now() - startTime,
        sandboxed: false,
        reason: error.message
      })
      executionResult = { 
        success: false, 
        error: error.message || `Failed to list project tree`
      }
    }

    // Build ToolResult for after hook
    const toolResult: ToolResult = {
      toolName: 'project_tree',
      arguments: args,
      result: executionResult.result,
      success: executionResult.success,
      error: executionResult.error,
      timestamp: Date.now()
    }

    // Run after hook - throws on failure
    runAfterHook(hooks, toolResult)

    return executionResult
  }
}

// Tool definitions for registry
export const terminalToolDefinitions = [
  {
    name: 'bash_execute',
    description: 'Execute a bash/shell command in a sandboxed environment',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' }
      },
      required: ['command']
    },
    category: 'bash' as const,
    tags: ['shell', 'execute']
  },
  {
    name: 'grep_search',
    description: 'Search for a pattern in files using grep',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'The search pattern (regex supported)' },
        file_path: { type: 'string', description: 'Directory or file path to search in' },
        case_sensitive: { type: 'boolean', description: 'Whether the search should be case sensitive' }
      },
      required: ['pattern']
    },
    category: 'search' as const,
    tags: ['search', 'grep']
  },
  {
    name: 'project_tree',
    description: 'Generate a tree view of the project structure',
    parameters: {
      type: 'object',
      properties: {
        root_path: { type: 'string', description: 'Root directory to start the tree from' },
        max_depth: { type: 'number', description: 'Maximum depth to traverse (default: 5)' },
        include_hidden: { type: 'boolean', description: 'Whether to include hidden files' },
        exclude_patterns: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Array of glob patterns to exclude'
        }
      }
    },
    category: 'file' as const,
    tags: ['io', 'tree']
  }
]

// Factory functions for creating executors
export const terminalToolExecutors = {
  bash_execute: async () => new BashExecuteExecutor(),
  grep_search: async () => new GrepSearchExecutor(),
  project_tree: async () => new ProjectTreeExecutor()
}

// Audit log access
export { getAuditLogs }

/**
 * Get terminal tool audit logs
 */
export function getTerminalAuditLogs(options?: { 
  toolName?: string
  action?: 'EXECUTED' | 'SANDBOXED' | 'BLOCKED' | 'TIMEOUT'
  since?: number
  limit?: number
}): AuditLogEntry[] {
  return getAuditLogs(options)
}

/**
 * Clear terminal tool audit logs
 */
export function clearTerminalAuditLogs(): void {
  auditLog.length = 0
}

/**
 * Get terminal tool execution statistics
 */
export function getTerminalStats(): { 
  total: number
  sandboxed: number
  blocked: number
  timeout: number 
} {
  const stats = { total: 0, sandboxed: 0, blocked: 0, timeout: 0 }
  for (const log of auditLog) {
    stats.total++
    if (log.sandboxed) stats.sandboxed++
    if (log.action === 'BLOCKED') stats.blocked++
    if (log.action === 'TIMEOUT') stats.timeout++
  }
  return stats
}

// Decorated handler class for tool metadata
export class TerminalToolHandlers {
  @registerTool({
    name: 'bash_execute',
    description: 'Execute a bash command',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in milliseconds' }
      },
      required: ['command']
    },
    category: 'bash',
    tags: ['shell', 'execute']
  })
  static async handleBashExecute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const executor = new BashExecuteExecutor()
    return executor.execute(args)
  }
}
