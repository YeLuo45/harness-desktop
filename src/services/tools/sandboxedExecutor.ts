/**
 * Sandboxed Executor - Wraps tool executors with sandbox checks
 * Returns ToolResult with success/error/auditEntries
 */

import type { ToolResult } from '../../types'
import type { AuditEntry } from '../sandbox'
import { ToolSandbox } from './toolSandbox'

export interface SandboxedExecutorOptions {
  sandbox: ToolSandbox
  onAuditEntry?: (entry: AuditEntry) => void
}

/**
 * Create a sandboxed tool executor function that wraps shell/filesystem tools
 */
export function createSandboxedExecutor(options: SandboxedExecutorOptions) {
  const { sandbox, onAuditEntry } = options

  /**
   * Execute a shell command with sandbox validation
   */
  async function executeShell(command: string, args?: string[], cwd?: string): Promise<ToolResult> {
    const startTime = Date.now()

    try {
      const result = await sandbox.executeShell({ command, args, cwd })

      const toolResult: ToolResult = {
        toolName: 'bash_execute',
        arguments: { command, args, cwd },
        result: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTime: result.executionTime
        },
        success: result.exitCode === 0 && !result.killed,
        timestamp: Date.now()
      }

      if (result.killed) {
        toolResult.error = 'Process killed due to timeout'
      } else if (result.exitCode !== 0) {
        toolResult.error = `Command exited with code ${result.exitCode}`
      }

      // Record audit entries
      const auditEntries = sandbox.getAuditEntries()
      for (const entry of auditEntries) {
        onAuditEntry?.(entry)
      }
      sandbox.clearAuditEntries()

      return toolResult
    } catch (error) {
      return {
        toolName: 'bash_execute',
        arguments: { command, args, cwd },
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      }
    }
  }

  /**
   * Validate file access with sandbox
   */
  async function validateFileAccess(path: string, operation: string): Promise<{ allowed: boolean; error?: string }> {
    const isAllowed = sandbox.validateFileAccess(path, operation)

    if (!isAllowed) {
      return {
        allowed: false,
        error: `File access denied: ${operation} on ${path} is not allowed`
      }
    }

    return { allowed: true }
  }

  /**
   * Check if path is within workspace
   */
  function isPathAllowed(path: string): boolean {
    return sandbox.isPathAllowed(path)
  }

  return {
    executeShell,
    validateFileAccess,
    isPathAllowed,
    sandbox
  }
}

export type SandboxedExecutor = ReturnType<typeof createSandboxedExecutor>