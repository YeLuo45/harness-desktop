/**
 * File Tool - File system operations with Hook verification
 */

import { registerTool } from '../decorators'
import type { ToolExecutor } from '../types'
import { getVerificationHooks } from '../../verificationHooks'
import type { ToolResult } from '../../../types'

// File system operations using Node.js
let fs: typeof import('fs') | null = null

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
  
  // Path traversal check for file operations
  if (args.path && typeof args.path === 'string') {
    if (args.path.includes('..')) {
      throw new Error(`[FileTool Hook] ${toolName} blocked: path contains directory traversal sequence`)
    }
  }
  
  // Additional before-hook validations can be added here
  // e.g., check if path is within allowed directories, check file size limits, etc.
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
