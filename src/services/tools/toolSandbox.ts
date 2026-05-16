/**
 * ToolSandbox - Sandbox wrapper for tool execution
 * Integrates SandboxManager with tool execution pipeline
 */

import { SandboxManager, SandboxConfig, SandboxResult, AuditEntry } from '../sandbox'

export interface ToolSandboxConfig {
  enabled: boolean
  workspaceRoot: string
  allowedCommands: string[]
  blockedPaths: string[]
  timeout: number
}

export interface ShellExecuteArgs {
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
}

export interface FileAccessArgs {
  path: string
  operation: 'read' | 'write' | 'delete' | 'list'
}

const DEFAULT_ALLOWED_COMMANDS = ['git', 'npm', 'node', 'python', 'python3', 'bun', 'pnpm', 'yarn']

export class ToolSandbox {
  private manager: SandboxManager | null = null
  private config: ToolSandboxConfig
  private auditEntries: AuditEntry[] = []

  constructor(config: ToolSandboxConfig) {
    this.config = { ...config }
    this.initManager()
  }

  /**
   * Initialize SandboxManager with configuration
   */
  private initManager(): void {
    if (!this.config.enabled) {
      this.manager = null
      return
    }

    const sandboxConfig: SandboxConfig = {
      timeout: this.config.timeout,
      memoryLimit: 256 * 1024 * 1024, // 256MB
      cpuLimit: 80,
      allowNetwork: false,
      allowedPaths: [this.config.workspaceRoot],
      blockedPaths: this.config.blockedPaths,
      workingDirectory: this.config.workspaceRoot,
      env: {}
    }

    this.manager = new SandboxManager(sandboxConfig)
  }

  /**
   * Execute a shell command with sandbox validation
   */
  async executeShell(args: ShellExecuteArgs): Promise<{
    stdout: string
    stderr: string
    exitCode: number | null
    killed: boolean
    executionTime: number
  }> {
    if (!this.manager) {
      // Sandbox disabled - execute directly (should not happen in production)
      return { stdout: '', stderr: 'Sandbox disabled', exitCode: -1, killed: false, executionTime: 0 }
    }

    // Validate command is in allowed list
    if (!this.isCommandAllowed(args.command)) {
      return {
        stdout: '',
        stderr: `Command not allowed: ${args.command}. Allowed commands: ${this.config.allowedCommands.join(', ')}`,
        exitCode: -1,
        killed: false,
        executionTime: 0
      }
    }

    // Validate working directory
    if (args.cwd && !this.isPathAllowed(args.cwd)) {
      return {
        stdout: '',
        stderr: `Working directory not allowed: ${args.cwd}`,
        exitCode: -1,
        killed: false,
        executionTime: 0
      }
    }

    // Execute via SandboxManager
    const result = await this.manager.execute(args.command, args.args || [])

    this.auditEntries.push(...result.auditEntries)
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      killed: result.killed,
      executionTime: result.executionTime
    }
  }

  /**
   * Validate file access operation
   */
  validateFileAccess(path: string, operation: string): boolean {
    if (!this.manager) return true // Sandbox disabled

    const isAllowed = this.manager.validateFileAccess(path, operation)
    this.auditEntries.push(...this.manager.getAuditEntries())
    return isAllowed
  }

  /**
   * Check if a path is within workspace boundary
   */
  isPathAllowed(path: string): boolean {
    if (!this.manager) return true // Sandbox disabled

    return this.manager.isPathAllowed(path)
  }

  /**
   * Check if command is in allowlist
   */
  private isCommandAllowed(command: string): boolean {
    // Extract base command (handle "npx foo" as "npx")
    const baseCommand = command.split(' ')[0]
    return this.config.allowedCommands.includes(baseCommand)
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ToolSandboxConfig>): void {
    this.config = { ...this.config, ...config }
    this.initManager()
  }

  /**
   * Get current configuration
   */
  getConfig(): ToolSandboxConfig {
    return { ...this.config }
  }

  /**
   * Get audit entries from last operations
   */
  getAuditEntries(): AuditEntry[] {
    return [...this.auditEntries]
  }

  /**
   * Clear audit entries
   */
  clearAuditEntries(): void {
    this.auditEntries = []
  }

  /**
   * Check if sandbox is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Get sandbox manager instance
   */
  getManager(): SandboxManager | null {
    return this.manager
  }

  /**
   * Close sandbox and cleanup
   */
  close(): void {
    if (this.manager) {
      this.manager.close()
      this.manager = null
    }
  }
}

/**
 * Create ToolSandbox with default configuration
 */
export function createToolSandbox(overrides?: Partial<ToolSandboxConfig>): ToolSandbox {
  const defaultConfig: ToolSandboxConfig = {
    enabled: true,
    workspaceRoot: process.cwd(),
    allowedCommands: DEFAULT_ALLOWED_COMMANDS,
    blockedPaths: ['/etc', '/root', '/home', '/sys', '/proc'],
    timeout: 30000
  }

  return new ToolSandbox({ ...defaultConfig, ...overrides })
}