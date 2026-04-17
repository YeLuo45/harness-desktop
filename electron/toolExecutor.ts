import { SandboxManager } from './sandboxManager'
import fs from 'fs'
import path from 'path'

interface ToolResult {
  success: boolean
  result?: unknown
  error?: string
}

export class ToolExecutor {
  private sandbox: SandboxManager

  constructor(sandbox: SandboxManager) {
    this.sandbox = sandbox
  }

  async execute(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    console.log(`[ToolExecutor] Executing tool: ${toolName}`, args)

    try {
      switch (toolName) {
        case 'file_read':
          return await this.file_read(args)
        case 'file_write':
          return await this.file_write(args)
        case 'file_append':
          return await this.file_append(args)
        case 'dir_list':
          return await this.dir_list(args)
        case 'bash_execute':
          return await this.bash_execute(args)
        case 'grep_search':
          return await this.grep_search(args)
        case 'glob':
          return await this.glob(args)
        case 'tool_status':
          return await this.tool_status(args)
        default:
          return { success: false, error: `Unknown tool: ${toolName}` }
      }
    } catch (error: any) {
      console.error(`[ToolExecutor] Error executing ${toolName}:`, error)
      return { success: false, error: error.message }
    }
  }

  private async file_read(args: Record<string, unknown>): Promise<ToolResult> {
    const { file_path } = args as { file_path: string }
    if (!file_path) {
      return { success: false, error: 'file_path is required' }
    }

    const check = this.sandbox.validatePath(file_path)
    if (!check.valid) {
      return { success: false, error: check.error }
    }

    try {
      const content = await fs.promises.readFile(check.resolved!, 'utf-8')
      const stats = await fs.promises.stat(check.resolved!)
      return {
        success: true,
        result: {
          content,
          lines: content.split('\n').length,
          size: stats.size,
          path: check.resolved
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async file_write(args: Record<string, unknown>): Promise<ToolResult> {
    const { file_path, content } = args as { file_path: string; content: string }
    if (!file_path || content === undefined) {
      return { success: false, error: 'file_path and content are required' }
    }

    const check = this.sandbox.validatePath(file_path)
    if (!check.valid) {
      return { success: false, error: check.error }
    }

    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(check.resolved!)
      await fs.promises.mkdir(parentDir, { recursive: true })
      await fs.promises.writeFile(check.resolved!, content, 'utf-8')
      const stats = await fs.promises.stat(check.resolved!)
      return {
        success: true,
        result: {
          path: check.resolved,
          bytesWritten: stats.size,
          lines: content.split('\n').length
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async file_append(args: Record<string, unknown>): Promise<ToolResult> {
    const { file_path, content } = args as { file_path: string; content: string }
    if (!file_path || content === undefined) {
      return { success: false, error: 'file_path and content are required' }
    }

    const check = this.sandbox.validatePath(file_path)
    if (!check.valid) {
      return { success: false, error: check.error }
    }

    try {
      await fs.promises.appendFile(check.resolved!, content, 'utf-8')
      const stats = await fs.promises.stat(check.resolved!)
      return {
        success: true,
        result: {
          path: check.resolved,
          totalBytes: stats.size
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async dir_list(args: Record<string, unknown>): Promise<ToolResult> {
    const { dir_path, recursive } = args as { dir_path?: string; recursive?: boolean }
    const targetPath = dir_path || this.sandbox.getWorkDir()

    const check = this.sandbox.validatePath(targetPath)
    if (!check.valid) {
      return { success: false, error: check.error }
    }

    try {
      const entries = await fs.promises.readdir(targetPath, { withFileTypes: true })
      const result: Array<{ name: string; type: 'file' | 'directory'; path: string }> = []

      for (const entry of entries) {
        result.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: path.join(targetPath, entry.name)
        })

        // Recursive listing
        if (recursive && entry.isDirectory()) {
          const subResult = await this.dir_listRecursive(path.join(targetPath, entry.name), 2)
          result.push(...subResult)
        }
      }

      return { success: true, result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async dir_listRecursive(basePath: string, maxDepth: number, currentDepth = 0): Promise<Array<{ name: string; type: 'file' | 'directory'; path: string }>> {
    if (currentDepth >= maxDepth) return []

    const result: Array<{ name: string; type: 'file' | 'directory'; path: string }> = []
    try {
      const entries = await fs.promises.readdir(basePath, { withFileTypes: true })
      for (const entry of entries) {
        result.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: path.join(basePath, entry.name)
        })
        if (entry.isDirectory()) {
          const sub = await this.dir_listRecursive(path.join(basePath, entry.name), maxDepth, currentDepth + 1)
          result.push(...sub)
        }
      }
    } catch {
      // Ignore permission errors in recursion
    }
    return result
  }

  private async bash_execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { command, timeout } = args as { command: string; timeout?: number }
    if (!command) {
      return { success: false, error: 'command is required' }
    }

    const checkResult = this.sandbox.validateCommand(command)
    if (!checkResult.valid) {
      return { success: false, error: checkResult.error }
    }

    try {
      const result = await this.sandbox.executeCommand(command, timeout as number || 30000)
      return {
        success: result.exitCode === 0,
        result: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          timedOut: result.timedOut
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async grep_search(args: Record<string, unknown>): Promise<ToolResult> {
    const { pattern, file_path, case_sensitive } = args as { pattern: string; file_path?: string; case_sensitive?: boolean }
    if (!pattern) {
      return { success: false, error: 'pattern is required' }
    }

    try {
      const searchPath = file_path ? this.sandbox.validatePath(file_path)?.resolved! : this.sandbox.getWorkDir()
      const check = this.sandbox.validatePath(searchPath)
      if (!check.valid) {
        return { success: false, error: check.error }
      }

      const matches: Array<{ file: string; line: number; content: string }> = []
      await this.grepRecursive(searchPath, pattern, case_sensitive !== false, matches)

      return { success: true, result: { matches, total: matches.length } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async grepRecursive(
    dirPath: string,
    pattern: string,
    caseSensitive: boolean,
    matches: Array<{ file: string; line: number; content: string }>,
    maxDepth = 3
  ): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
      const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi')

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (maxDepth > 0) {
            await this.grepRecursive(path.join(dirPath, entry.name), pattern, caseSensitive, matches, maxDepth - 1)
          }
        } else if (entry.isFile()) {
          try {
            const content = await fs.promises.readFile(path.join(dirPath, entry.name), 'utf-8')
            const lines = content.split('\n')
            lines.forEach((line, idx) => {
              if (regex.test(line)) {
                matches.push({
                  file: path.join(dirPath, entry.name),
                  line: idx + 1,
                  content: line.trim()
                })
              }
            })
          } catch {
            // Skip binary files or permission errors
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  private async glob(args: Record<string, unknown>): Promise<ToolResult> {
    const { pattern } = args as { pattern: string }
    if (!pattern) {
      return { success: false, error: 'pattern is required' }
    }

    try {
      const workDir = this.sandbox.getWorkDir()
      // Simple glob implementation - convert pattern to regex
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '{{GLOBSTAR}}')
        .replace(/\*/g, '[^/]*')
        .replace(/{{GLOBSTAR}}/g, '.*')
        .replace(/\?/g, '.')

      const regex = new RegExp(`^${regexPattern}$`, 'i')
      const matches: string[] = []

      await this.globRecursive(workDir, regex, matches)

      return { success: true, result: { matches, total: matches.length } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async globRecursive(
    dirPath: string,
    pattern: RegExp,
    matches: string[],
    maxDepth = 5,
    currentDepth = 0
  ): Promise<void> {
    if (currentDepth > maxDepth) return

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        if (pattern.test(entry.name)) {
          matches.push(path.join(dirPath, entry.name))
        }
        if (entry.isDirectory()) {
          await this.globRecursive(path.join(dirPath, entry.name), pattern, matches, maxDepth, currentDepth + 1)
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  private async tool_status(_args: Record<string, unknown>): Promise<ToolResult> {
    return {
      success: true,
      result: {
        sandbox: this.sandbox.getStatus(),
        timestamp: new Date().toISOString(),
        tools: ['file_read', 'file_write', 'file_append', 'dir_list', 'bash_execute', 'grep_search', 'glob', 'tool_status']
      }
    }
  }
}
