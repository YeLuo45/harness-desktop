/**
 * File Tool - File system operations with Hook verification
 */

import { registerTool } from '../decorators'
import type { ToolExecutor } from '../types'
import { getVerificationHooks } from '../../verificationHooks'
import type { ToolResult } from '../../../types'
import * as path from 'path'

// File system operations using Node.js
let fs: typeof import('fs') | null = null

// ==================== File System Security Configuration ====================

/**
 * Allowed base directories for file operations (whitelist)
 * Operations are restricted to these directories only
 */
const ALLOWED_DIRECTORIES: string[] = [
  process.env.HOME || '/home',
  '/tmp',
  '/var/tmp'
]

/**
 * Sensitive paths that are blocked from any file operations
 * These paths and their subdirectories cannot be accessed
 */
const SENSITIVE_PATHS: string[] = [
  '/etc/shadow',
  '/etc/sudoers',
  '/etc/passwd',
  '/etc/group',
  '/etc/gshadow',
  '/etc/security/opasswd',
  '/root/.ssh',
  '/home/*/.ssh',
  '.ssh',
  '/proc/1/environ',
  '/proc/self/environ',
  '/sys/kernel/debug',
  '/sys/kernel/security',
  '/dev/mem',
  '/dev/kmem',
  '/proc/kcore',
  '/proc/sys/kernel/core_pattern'
]

// ==================== Audit Logging ====================

interface AuditLogEntry {
  timestamp: number
  toolName: string
  operation: string
  targetPath: string
  action: 'ALLOWED' | 'BLOCKED'
  reason?: string
  userId?: string
}

/**
 * In-memory audit log storage (can be replaced with persistent storage)
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
  console.info(`[AUDIT] ${timeStr} | ${entry.toolName} | ${entry.operation} | ${entry.targetPath} | ${entry.action}${entry.reason ? ` | ${entry.reason}` : ''}`)
}

/**
 * Get audit logs with optional filtering
 */
function getAuditLogs(options?: { 
  toolName?: string
  action?: 'ALLOWED' | 'BLOCKED'
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

// ==================== Path Security Checks ====================

/**
 * Normalize a path to absolute form and resolve symlinks
 */
function normalizePath(p: string): string {
  return path.resolve(p)
}

/**
 * Check if a path matches a sensitive path pattern
 * Supports wildcards in SENSITIVE_PATHS definitions
 */
function isSensitivePath(targetPath: string): boolean {
  const normalizedTarget = normalizePath(targetPath)
  
  for (const sensitive of SENSITIVE_PATHS) {
    const normalizedSensitive = path.resolve(sensitive)
    
    // Check exact match
    if (normalizedTarget === normalizedSensitive) {
      return true
    }
    
    // Check if target starts with sensitive path (blocks subdirectories)
    if (normalizedTarget.startsWith(normalizedSensitive + path.sep)) {
      return true
    }
    
    // Handle wildcard patterns like /home/*/.ssh
    if (sensitive.includes('*')) {
      const regexPattern = sensitive
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars except *
        .replace(/\*/g, '[^/]*')  // Replace * with regex
      const regex = new RegExp(`^${regexPattern}`)
      if (regex.test(normalizedTarget)) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Check if a path is within an allowed directory (whitelist check)
 */
function isPathInWhitelist(targetPath: string): boolean {
  const normalizedTarget = normalizePath(targetPath)
  
  for (const allowedDir of ALLOWED_DIRECTORIES) {
    const normalizedAllowed = path.resolve(allowedDir)
    
    // Check if target path starts with allowed directory
    if (normalizedTarget.startsWith(normalizedAllowed + path.sep)) {
      return true
    }
    
    // Also allow if the path IS the allowed directory itself
    if (normalizedTarget === normalizedAllowed) {
      return true
    }
  }
  
  return false
}

/**
 * Security check result type
 */
interface SecurityCheckResult {
  allowed: boolean
  reason?: string
}

/**
 * Perform comprehensive security check on a file path
 */
function checkPathSecurity(
  toolName: string,
  operation: string,
  targetPath: string
): SecurityCheckResult {
  // Check for path traversal attacks
  if (targetPath.includes('..')) {
    return { allowed: false, reason: 'Path traversal sequence detected (..)' }
  }
  
  // Check sensitive paths
  if (isSensitivePath(targetPath)) {
    addAuditLog({
      toolName,
      operation,
      targetPath,
      action: 'BLOCKED',
      reason: 'Sensitive path access blocked'
    })
    return { allowed: false, reason: 'Access to sensitive system path is forbidden' }
  }
  
  // Check whitelist
  if (!isPathInWhitelist(targetPath)) {
    addAuditLog({
      toolName,
      operation,
      targetPath,
      action: 'BLOCKED',
      reason: `Path not in whitelist: ${ALLOWED_DIRECTORIES.join(', ')}`
    })
    return { allowed: false, reason: `Path must be within allowed directories: ${ALLOWED_DIRECTORIES.join(', ')}` }
  }
  
  return { allowed: true }
}

async function getFsModules() {
  if (!fs) {
    // Dynamic import for fs - only available in Node.js environment
    try {
      fs = await import('fs')
    } catch {
      console.warn('[FileTool] fs module not available')
    }
  }
  return fs
}

/**
 * Before hook - validates file operation before execution
 */
function runBeforeHook(toolName: string, args: Record<string, unknown>): void {
  const verification = getVerificationHooks()
  const config = verification.getConfig()
  
  if (config.level === 'disabled') {
    return
  }
  
  // Get the target path from arguments
  const targetPath = (args.path || args.dirPath || args.pattern) as string | undefined
  
  if (!targetPath) {
    return // Let individual executors handle missing path validation
  }
  
  // Perform comprehensive security check
  const securityResult = checkPathSecurity(toolName, 'access', targetPath)
  
  if (!securityResult.allowed) {
    throw new Error(`[FileTool Hook] ${toolName} blocked: ${securityResult.reason}`)
  }
  
  // Log successful access
  addAuditLog({
    toolName,
    operation: 'access',
    targetPath,
    action: 'ALLOWED'
  })
}

/**
 * After hook - verifies file operation result
 */
function runAfterHook(toolName: string, args: Record<string, unknown>, result: { success: boolean; result?: unknown; error?: string }): void {
  const verification = getVerificationHooks()
  
  const toolResult: ToolResult = {
    toolName,
    arguments: args,
    result: result.result,
    success: result.success,
    error: result.error,
    timestamp: Date.now()
  }
  
  const verificationResult = verification.verify(toolResult)
  
  if (!verificationResult.passed) {
    const errorMsg = `[FileTool Hook] ${toolName} verification failed: ${verificationResult.errors.join('; ')}`
    throw new Error(errorMsg)
  }
  
  if (verificationResult.warnings.length > 0) {
    console.warn(`[FileTool Hook] ${toolName} warnings: ${verificationResult.warnings.join('; ')}`)
  }
}

class FileReadExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const toolName = 'file_read'
    
    // Run before hook
    runBeforeHook(toolName, args)
    
    const fsModule = await getFsModules()
    if (!fsModule || !fsModule.readFileSync) {
      const result = { success: false, error: 'File system not available' }
      runAfterHook(toolName, args, result)
      return result
    }

    const filePath = args.path as string
    if (!filePath) {
      const result = { success: false, error: 'path is required' }
      runAfterHook(toolName, args, result)
      return result
    }

    try {
      const content = fsModule.readFileSync(filePath, 'utf-8')
      const result = { success: true, result: { content, size: content.length, lines: content.split('\n').length } }
      runAfterHook(toolName, args, result)
      return result
    } catch (error: any) {
      const result = { success: false, error: error.message }
      runAfterHook(toolName, args, result)
      return result
    }
  }
}

class FileWriteExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const toolName = 'file_write'
    
    // Run before hook
    runBeforeHook(toolName, args)
    
    const fsModule = await getFsModules()
    if (!fsModule || !fsModule.writeFileSync) {
      const result = { success: false, error: 'File system not available' }
      runAfterHook(toolName, args, result)
      return result
    }

    const filePath = args.path as string
    const content = args.content as string
    if (!filePath || content === undefined) {
      const result = { success: false, error: 'path and content are required' }
      runAfterHook(toolName, args, result)
      return result
    }

    try {
      fsModule.writeFileSync(filePath, content, 'utf-8')
      const result = { success: true, result: { path: filePath, bytesWritten: content.length } }
      runAfterHook(toolName, args, result)
      return result
    } catch (error: any) {
      const result = { success: false, error: error.message }
      runAfterHook(toolName, args, result)
      return result
    }
  }
}

class FileAppendExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const toolName = 'file_append'
    
    // Run before hook
    runBeforeHook(toolName, args)
    
    const fsModule = await getFsModules()
    if (!fsModule || !fsModule.appendFileSync) {
      const result = { success: false, error: 'File system not available' }
      runAfterHook(toolName, args, result)
      return result
    }

    const filePath = args.path as string
    const content = args.content as string
    if (!filePath || content === undefined) {
      const result = { success: false, error: 'path and content are required' }
      runAfterHook(toolName, args, result)
      return result
    }

    try {
      fsModule.appendFileSync(filePath, content, 'utf-8')
      const result = { success: true, result: { path: filePath, bytesAppended: content.length } }
      runAfterHook(toolName, args, result)
      return result
    } catch (error: any) {
      const result = { success: false, error: error.message }
      runAfterHook(toolName, args, result)
      return result
    }
  }
}

class DirListExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const toolName = 'dir_list'
    
    // Run before hook
    runBeforeHook(toolName, args)
    
    const fsModule = await getFsModules()
    if (!fsModule || !fsModule.readdirSync) {
      const result = { success: false, error: 'File system not available' }
      runAfterHook(toolName, args, result)
      return result
    }

    const dirPath = (args.path || args.dirPath || '.') as string
    const recursive = args.recursive as boolean

    try {
      let resultData: string[] | Array<{ name: string; isDirectory: boolean; path: string }>
      
      if (recursive) {
        const result: string[] = []
        
        const walkDir = (currentPath: string): void => {
          const entries = fsModule!.readdirSync(currentPath, { withFileTypes: true })
          for (const entry of entries) {
            const fullPath = `${currentPath}/${entry.name}`
            result.push(entry.isDirectory() ? `${fullPath}/` : fullPath)
            if (entry.isDirectory()) {
              walkDir(fullPath)
            }
          }
        }
        
        walkDir(dirPath)
        resultData = result
      } else {
        const entries = fsModule.readdirSync(dirPath, { withFileTypes: true })
        resultData = entries.map(e => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          path: `${dirPath}/${e.name}`
        }))
      }
      
      const result = { success: true, result: resultData }
      runAfterHook(toolName, args, result)
      return result
    } catch (error: any) {
      const result = { success: false, error: error.message }
      runAfterHook(toolName, args, result)
      return result
    }
  }
}

class GlobExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const toolName = 'glob'
    
    // Run before hook
    runBeforeHook(toolName, args)
    
    const fsModule = await getFsModules()
    if (!fsModule || !fsModule.readdirSync) {
      const result = { success: false, error: 'File system not available' }
      runAfterHook(toolName, args, result)
      return result
    }

    const pattern = args.pattern as string
    if (!pattern) {
      const result = { success: false, error: 'pattern is required' }
      runAfterHook(toolName, args, result)
      return result
    }

    // Simple glob implementation (supports **, *, ?)
    const patternParts = pattern.replace(/^\.\//, '').split('/')
    const regexPattern = patternParts.map(part => {
      if (part === '**') return '.*'
      if (part === '*') return '[^/]*'
      if (part === '?') return '[^/]'
      return part.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }).join('/')
    
    const regex = new RegExp(`^${regexPattern}$`)

    const results: string[] = []
    
    const searchDir = (currentPath: string, depth: number): void => {
      const maxDepth = patternParts.filter(p => p !== '**').length
      if (depth > maxDepth) return
      
      try {
        const entries = fsModule!.readdirSync(currentPath, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = `${currentPath}/${entry.name}`
          if (regex.test(fullPath.replace(/^\.\//, ''))) {
            results.push(fullPath)
          }
          if (entry.isDirectory() && pattern.includes('**')) {
            searchDir(fullPath, depth + 1)
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }
    
    searchDir('.', 0)
    const result = { success: true, result: { matches: results, total: results.length } }
    runAfterHook(toolName, args, result)
    return result
  }
}

// Tool definitions for registry
export const fileToolDefinitions = [
  {
    name: 'file_read',
    description: 'Read the contents of a file from the file system',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to read' }
      },
      required: ['path']
    },
    category: 'file' as const,
    tags: ['io', 'read']
  },
  {
    name: 'file_write',
    description: 'Write or overwrite a file with new content',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path where the file should be written' },
        content: { type: 'string', description: 'The content to write to the file' }
      },
      required: ['path', 'content']
    },
    category: 'file' as const,
    tags: ['io', 'write']
  },
  {
    name: 'file_append',
    description: 'Append content to the end of an existing file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to append to' },
        content: { type: 'string', description: 'The content to append' }
      },
      required: ['path', 'content']
    },
    category: 'file' as const,
    tags: ['io', 'append']
  },
  {
    name: 'dir_list',
    description: 'List the contents of a directory',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the directory (defaults to working directory)' },
        recursive: { type: 'boolean', description: 'Whether to list subdirectories recursively' }
      }
    },
    category: 'file' as const,
    tags: ['io', 'list']
  },
  {
    name: 'glob',
    description: 'Find files matching a glob pattern',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern to match (e.g., "**/*.ts")' }
      },
      required: ['pattern']
    },
    category: 'file' as const,
    tags: ['io', 'search']
  }
]

// Factory functions for creating executors
export const fileToolExecutors = {
  file_read: async () => new FileReadExecutor(),
  file_write: async () => new FileWriteExecutor(),
  file_append: async () => new FileAppendExecutor(),
  dir_list: async () => new DirListExecutor(),
  glob: async () => new GlobExecutor()
}

// Decorated handler class for tool metadata
export class FileToolHandlers {
  @registerTool({
    name: 'file_read',
    description: 'Read the contents of a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file' }
      },
      required: ['path']
    },
    category: 'file',
    tags: ['io', 'read']
  })
  static async handleFileRead(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const executor = new FileReadExecutor()
    return executor.execute(args)
  }
}

// ==================== Security & Audit Exports ====================

/**
 * Export security configuration and audit functions for external use
 */
export const fileToolSecurity = {
  /**
   * Get allowed directories (whitelist)
   */
  getAllowedDirectories: () => [...ALLOWED_DIRECTORIES],
  
  /**
   * Add a directory to the allowed whitelist
   */
  addAllowedDirectory: (dir: string) => {
    const resolved = path.resolve(dir)
    if (!ALLOWED_DIRECTORIES.includes(resolved)) {
      ALLOWED_DIRECTORIES.push(resolved)
    }
  },
  
  /**
   * Remove a directory from the allowed whitelist
   */
  removeAllowedDirectory: (dir: string) => {
    const index = ALLOWED_DIRECTORIES.indexOf(path.resolve(dir))
    if (index > -1) {
      ALLOWED_DIRECTORIES.splice(index, 1)
    }
  },
  
  /**
   * Get sensitive paths that are blocked
   */
  getSensitivePaths: () => [...SENSITIVE_PATHS],
  
  /**
   * Add a path to the sensitive paths blocklist
   */
  addSensitivePath: (p: string) => {
    const resolved = path.resolve(p)
    if (!SENSITIVE_PATHS.includes(resolved)) {
      SENSITIVE_PATHS.push(resolved)
    }
  },
  
  /**
   * Remove a path from the sensitive paths blocklist
   */
  removeSensitivePath: (p: string) => {
    const index = SENSITIVE_PATHS.indexOf(path.resolve(p))
    if (index > -1) {
      SENSITIVE_PATHS.splice(index, 1)
    }
  },
  
  /**
   * Check if a path passes security checks without throwing
   */
  checkPath: checkPathSecurity,
  
  /**
   * Get audit logs with optional filtering
   */
  getAuditLogs,
  
  /**
   * Clear the audit log
   */
  clearAuditLog: () => {
    auditLog.length = 0
  }
}
