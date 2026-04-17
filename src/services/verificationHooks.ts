import type { ToolResult } from '../types'

export interface VerificationResult {
  passed: boolean
  warnings: string[]
  errors: string[]
}

export class VerificationHooks {
  // Verify file_read result
  verifyFileRead(result: ToolResult): VerificationResult {
    const warnings: string[] = []
    const errors: string[] = []

    if (!result.success) {
      errors.push(`File read failed: ${result.error}`)
      return { passed: false, warnings, errors }
    }

    const data = result.result as { content?: string; lines?: number; size?: number }

    // Check for empty content
    if (data.content !== undefined && data.content.length === 0) {
      warnings.push('File is empty')
    }

    // Check for suspiciously large files
    if (data.size !== undefined && data.size > 5 * 1024 * 1024) {
      warnings.push(`Large file (${(data.size / 1024 / 1024).toFixed(2)} MB). Consider reading specific sections.`)
    }

    // Check for binary-looking content
    if (data.content !== undefined && /[\x00-\x08\x0E-\x1F]/.test(data.content.slice(0, 1000))) {
      warnings.push('File may contain binary data')
    }

    return { passed: errors.length === 0, warnings, errors }
  }

  // Verify file_write result
  verifyFileWrite(result: ToolResult): VerificationResult {
    const warnings: string[] = []
    const errors: string[] = []

    if (!result.success) {
      errors.push(`File write failed: ${result.error}`)
      return { passed: false, warnings, errors }
    }

    const data = result.result as { bytesWritten?: number; path?: string }

    // Check for zero-byte write
    if (data.bytesWritten === 0) {
      warnings.push('File was written but contains no data')
    }

    // Verify the path is within expected directory
    if (data.path?.includes('..')) {
      errors.push('File path contains directory traversal')
    }

    return { passed: errors.length === 0, warnings, errors }
  }

  // Verify bash_execute result
  verifyBashExecute(result: ToolResult): VerificationResult {
    const warnings: string[] = []
    const errors: string[] = []

    if (!result.success) {
      // Non-zero exit code doesn't always mean failure
      warnings.push(`Command exited with code ${(result.result as any)?.exitCode || 'unknown'}`)
    }

    const data = result.result as { stdout?: string; stderr?: string; exitCode?: number; timedOut?: boolean }

    // Check for timeout
    if (data.timedOut) {
      errors.push('Command timed out')
    }

    // Check for stderr output
    if (data.stderr && data.stderr.trim().length > 0) {
      // Check for common error patterns
      const stderr = data.stderr
      const errorPatterns = ['error:', 'Error:', 'ERROR', 'failed', 'Failed', 'FAILED', 'exception', 'Exception']
      const hasError = errorPatterns.some(p => stderr.includes(p))
      if (hasError) {
        warnings.push(`stderr contains error output: ${stderr.slice(0, 200)}`)
      }
    }

    // Check for very large output (potential issues)
    if (data.stdout && data.stdout.length > 100000) {
      warnings.push('Command produced very large output (>100KB). Consider using more specific commands.')
    }

    return { passed: errors.length === 0, warnings, errors }
  }

  // Verify grep_search result
  verifyGrepSearch(result: ToolResult): VerificationResult {
    const warnings: string[] = []
    const errors: string[] = []

    if (!result.success) {
      errors.push(`Search failed: ${result.error}`)
      return { passed: false, warnings, errors }
    }

    const data = result.result as { matches?: unknown[]; total?: number }

    if (data.total === 0) {
      warnings.push('No matches found')
    }

    if (data.total && data.total > 1000) {
      warnings.push(`Large number of matches (${data.total}). Results may be truncated.`)
    }

    return { passed: errors.length === 0, warnings, errors }
  }

  // Verify glob result
  verifyGlob(result: ToolResult): VerificationResult {
    const warnings: string[] = []
    const errors: string[] = []

    if (!result.success) {
      errors.push(`Glob search failed: ${result.error}`)
      return { passed: false, warnings, errors }
    }

    const data = result.result as { matches?: string[]; total?: number }

    if (data.total === 0) {
      warnings.push('No files matched the pattern')
    }

    return { passed: errors.length === 0, warnings, errors }
  }

  // Verify dir_list result
  verifyDirList(result: ToolResult): VerificationResult {
    const warnings: string[] = []
    const errors: string[] = []

    if (!result.success) {
      errors.push(`Directory listing failed: ${result.error}`)
      return { passed: false, warnings, errors }
    }

    return { passed: true, warnings, errors }
  }

  // General verification for any tool
  verify(result: ToolResult): VerificationResult {
    switch (result.toolName) {
      case 'file_read':
        return this.verifyFileRead(result)
      case 'file_write':
        return this.verifyFileWrite(result)
      case 'bash_execute':
        return this.verifyBashExecute(result)
      case 'grep_search':
        return this.verifyGrepSearch(result)
      case 'glob':
        return this.verifyGlob(result)
      case 'dir_list':
        return this.verifyDirList(result)
      default:
        return {
          passed: result.success,
          warnings: [],
          errors: result.success ? [] : [`Unknown tool: ${result.toolName}`]
        }
    }
  }

  // Format verification result for display
  formatVerificationMessage(result: VerificationResult): string {
    if (result.passed && result.warnings.length === 0) {
      return ''
    }

    const parts: string[] = []

    if (!result.passed) {
      parts.push(`❌ Errors: ${result.errors.join('; ')}`)
    }

    if (result.warnings.length > 0) {
      parts.push(`⚠️ Warnings: ${result.warnings.join('; ')}`)
    }

    return parts.join('\n')
  }
}

// Singleton
let verificationHooksInstance: VerificationHooks | null = null

export function getVerificationHooks(): VerificationHooks {
  if (!verificationHooksInstance) {
    verificationHooksInstance = new VerificationHooks()
  }
  return verificationHooksInstance
}
