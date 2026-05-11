/**
 * File Tool - File system operations
 */

import { registerTool } from '../decorators'
import type { ToolExecutor } from '../types'

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

class FileReadExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const fsModule = await getFsModules()
    if (!fsModule || !fsModule.readFileSync) {
      return { success: false, error: 'File system not available' }
    }

    const filePath = args.path as string
    if (!filePath) {
      return { success: false, error: 'path is required' }
    }

    try {
      const content = fsModule.readFileSync(filePath, 'utf-8')
      return { success: true, result: content }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

class FileWriteExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const fsModule = await getFsModules()
    if (!fsModule || !fsModule.writeFileSync) {
      return { success: false, error: 'File system not available' }
    }

    const filePath = args.path as string
    const content = args.content as string
    if (!filePath || content === undefined) {
      return { success: false, error: 'path and content are required' }
    }

    try {
      fsModule.writeFileSync(filePath, content, 'utf-8')
      return { success: true, result: `Written to ${filePath}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

class FileAppendExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const fsModule = await getFsModules()
    if (!fsModule || !fsModule.appendFileSync) {
      return { success: false, error: 'File system not available' }
    }

    const filePath = args.path as string
    const content = args.content as string
    if (!filePath || content === undefined) {
      return { success: false, error: 'path and content are required' }
    }

    try {
      fsModule.appendFileSync(filePath, content, 'utf-8')
      return { success: true, result: `Appended to ${filePath}` }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

class DirListExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const fsModule = await getFsModules()
    if (!fsModule || !fsModule.readdirSync) {
      return { success: false, error: 'File system not available' }
    }

    const dirPath = (args.path || args.dirPath || '.') as string
    const recursive = args.recursive as boolean

    try {
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
        return { success: true, result }
      } else {
        const entries = fsModule.readdirSync(dirPath, { withFileTypes: true })
        const result = entries.map(e => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          path: `${dirPath}/${e.name}`
        }))
        return { success: true, result }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}

class GlobExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const fsModule = await getFsModules()
    if (!fsModule || !fsModule.readdirSync) {
      return { success: false, error: 'File system not available' }
    }

    const pattern = args.pattern as string
    if (!pattern) {
      return { success: false, error: 'pattern is required' }
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
    return { success: true, result: results }
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
