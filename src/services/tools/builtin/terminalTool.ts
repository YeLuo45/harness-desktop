/**
 * Terminal Tool - Shell command execution
 */

import { registerTool } from '../decorators'
import type { ToolExecutor } from '../types'

// Child process module - only available in Node.js environment
let childProcess: typeof import('child_process') | null = null

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

class BashExecuteExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const cp = await getChildProcess()
    if (!cp || !cp.execSync) {
      return { success: false, error: 'Child process not available' }
    }

    const command = args.command as string
    const timeout = (args.timeout as number) || 30000

    if (!command) {
      return { success: false, error: 'command is required' }
    }

    try {
      const result = cp.execSync(command, {
        encoding: 'utf-8',
        timeout,
        stdio: 'pipe'
      })
      return { success: true, result }
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || `Command failed: ${command}`,
        result: error.stdout ? String(error.stdout) : undefined
      }
    }
  }
}

class GrepSearchExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const cp = await getChildProcess()
    if (!cp || !cp.execSync) {
      return { success: false, error: 'Child process not available' }
    }

    const pattern = args.pattern as string
    const filePath = args.file_path as string
    const caseSensitive = args.case_sensitive as boolean

    if (!pattern) {
      return { success: false, error: 'pattern is required' }
    }

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

      const result = cp.execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' })
      return { success: true, result }
    } catch (error: any) {
      // grep returns exit code 1 when no matches found, which throws
      if (error.status === 1) {
        return { success: true, result: [] }
      }
      return { 
        success: false, 
        error: error.message || `Search failed for: ${pattern}`
      }
    }
  }
}

class ProjectTreeExecutor implements ToolExecutor {
  async execute(args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const cp = await getChildProcess()
    if (!cp || !cp.execSync) {
      return { success: false, error: 'Child process not available' }
    }

    const rootPath = (args.root_path || '.').toString()
    const maxDepth = (args.max_depth as number) || 5
    const includeHidden = (args.include_hidden as boolean) || false
    const excludePatterns = (args.exclude_patterns as string[]) || []

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
      cmd += ` "${rootPath}"`

      const result = cp.execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' })
      const files = result.split('\n').filter(f => f.trim())
      return { success: true, result: files }
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || `Failed to list project tree`
      }
    }
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
