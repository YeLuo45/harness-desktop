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
        // v2: New tools
        case 'edit_code':
          return await this.edit_code(args)
        case 'project_tree':
          return await this.project_tree(args)
        case 'web_search':
          return await this.web_search(args)
        case 'task_plan':
          return await this.task_plan(args)
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
        tools: ['file_read', 'file_write', 'file_append', 'dir_list', 'bash_execute', 'grep_search', 'glob', 'tool_status', 'edit_code', 'project_tree', 'web_search', 'task_plan']
      }
    }
  }

  // v2: edit_code - Apply code modifications using unified diff format
  private async edit_code(args: Record<string, unknown>): Promise<ToolResult> {
    const { file_path, diff, create_backup } = args as { file_path: string; diff: string; create_backup?: boolean }
    if (!file_path || !diff) {
      return { success: false, error: 'file_path and diff are required' }
    }

    const check = this.sandbox.validatePath(file_path)
    if (!check.valid) {
      return { success: false, error: check.error }
    }

    try {
      // Create backup if requested
      if (create_backup !== false) {
        const backupPath = check.resolved! + '.bak'
        await fs.promises.copyFile(check.resolved!, backupPath)
      }

      // Read the original file
      const originalContent = await fs.promises.readFile(check.resolved!, 'utf-8')

      // Parse the unified diff and apply changes
      const patchedContent = this.applyUnifiedDiff(originalContent, diff)

      // Write the patched content
      await fs.promises.writeFile(check.resolved!, patchedContent, 'utf-8')

      // Count how many patches were applied
      const patchCount = (diff.match(/^@@/gm) || []).length

      return {
        success: true,
        result: {
          path: check.resolved,
          applied: patchCount,
          patches: patchCount
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Helper: Apply unified diff to content
  private applyUnifiedDiff(original: string, diff: string): string {
    const lines = original.split('\n')
    const diffLines = diff.split('\n')

    // Track the hunks
    const hunks: Array<{
      oldStart: number
      oldCount: number
      newStart: number
      newCount: number
      changes: Array<{ type: 'keep' | 'delete' | 'add'; content: string }>
    }> = []

    let i = 0
    while (i < diffLines.length) {
      const line = diffLines[i]

      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/)
      if (hunkMatch) {
        const hunk: any = {
          oldStart: parseInt(hunkMatch[1], 10) - 1, // Convert to 0-indexed
          oldCount: parseInt(hunkMatch[2] || '1', 10),
          newStart: parseInt(hunkMatch[3], 10) - 1,
          newCount: parseInt(hunkMatch[4] || '1', 10),
          changes: []
        }

        i++

        // Read hunk content
        while (i < diffLines.length && !diffLines[i].startsWith('@@')) {
          const dLine = diffLines[i]
          if (dLine.startsWith('-')) {
            hunk.changes.push({ type: 'delete', content: dLine.slice(1) })
          } else if (dLine.startsWith('+')) {
            hunk.changes.push({ type: 'add', content: dLine.slice(1) })
          } else if (dLine.startsWith(' ') || dLine === '') {
            hunk.changes.push({ type: 'keep', content: dLine.slice(1) })
          }
          i++
        }

        hunks.push(hunk)
      } else {
        i++
      }
    }

    // Apply hunks in reverse order to maintain line numbers
    let result = [...lines]
    for (let h = hunks.length - 1; h >= 0; h--) {
      const hunk = hunks[h]
      let resultIdx = hunk.oldStart
      const newLines: string[] = []

      for (const change of hunk.changes) {
        if (change.type === 'keep') {
          if (resultIdx < result.length) {
            newLines.push(result[resultIdx])
          }
          resultIdx++
        } else if (change.type === 'add') {
          newLines.push(change.content)
        }
        // 'delete' type just skips resultIdx
      }

      // Replace the old lines with new lines
      result.splice(hunk.oldStart, hunk.oldCount, ...newLines)
    }

    return result.join('\n')
  }

  // v2: project_tree - Generate a tree view of project structure
  private async project_tree(args: Record<string, unknown>): Promise<ToolResult> {
    const {
      root_path,
      max_depth,
      include_hidden,
      exclude_patterns
    } = args as {
      root_path?: string
      max_depth?: number
      include_hidden?: boolean
      exclude_patterns?: string[]
    }

    const targetPath = root_path || this.sandbox.getWorkDir()
    const depth = max_depth ?? 5
    const hidden = include_hidden ?? false
    const excludes = exclude_patterns || ['node_modules', '.git', 'dist', 'build', '__pycache__']

    const check = this.sandbox.validatePath(targetPath)
    if (!check.valid) {
      return { success: false, error: check.error }
    }

    try {
      const tree = await this.buildTree(check.resolved!, depth, hidden, excludes, 0)

      // Count files and directories
      let fileCount = 0
      let dirCount = 0
      const countNodes = (node: TreeNode) => {
        if (node.type === 'file') fileCount++
        else dirCount++
        node.children?.forEach(countNodes)
      }
      countNodes(tree)

      return {
        success: true,
        result: {
          tree,
          files: fileCount,
          directories: dirCount,
          depth
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private async buildTree(
    dirPath: string,
    maxDepth: number,
    includeHidden: boolean,
    excludePatterns: string[],
    currentDepth: number
  ): Promise<TreeNode> {
    const name = path.basename(dirPath)
    const node: TreeNode = {
      name,
      type: 'directory',
      path: dirPath,
      children: []
    }

    if (currentDepth >= maxDepth) {
      return node
    }

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        // Skip hidden files if not included
        if (!includeHidden && entry.name.startsWith('.')) continue

        // Skip excluded patterns
        if (excludePatterns.some(pattern => this.matchGlob(entry.name, pattern))) continue

        const fullPath = path.join(dirPath, entry.name)

        if (entry.isDirectory()) {
          const childNode = await this.buildTree(fullPath, maxDepth, includeHidden, excludePatterns, currentDepth + 1)
          node.children!.push(childNode)
        } else {
          node.children!.push({
            name: entry.name,
            type: 'file',
            path: fullPath
          })
        }
      }
    } catch {
      // Permission error - skip
    }

    return node
  }

  private matchGlob(name: string, pattern: string): boolean {
    // Simple glob matching
    if (pattern === '*') return name.includes('.')
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1)
      return name.endsWith(ext)
    }
    return name === pattern || name.includes(pattern)
  }

  // v2: web_search - Search the web using Brave Search API
  private async web_search(args: Record<string, unknown>): Promise<ToolResult> {
    const { query, count, freshness } = args as { query: string; count?: number; freshness?: string }

    if (!query) {
      return { success: false, error: 'query is required' }
    }

    // Get API key from environment or config
    const apiKey = process.env.BRAVE_SEARCH_API_KEY || ''
    if (!apiKey) {
      return { success: false, error: 'Brave Search API key not configured. Set BRAVE_SEARCH_API_KEY environment variable.' }
    }

    try {
      const params = new URLSearchParams({
        q: query,
        count: String(count || 5)
      })

      if (freshness) {
        params.set('freshness', freshness)
      }

      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, error: `Brave Search API error: ${response.status} ${errorText}` }
      }

      const data = await response.json()

      // Parse results
      const results = (data.results || []).map((r: any) => ({
        title: r.title,
        url: r.url,
        description: r.description,
        pageAge: r.page_age
      }))

      return {
        success: true,
        result: {
          query,
          results,
          total: results.length
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // v2: task_plan - Decompose complex task into subtasks
  private async task_plan(args: Record<string, unknown>): Promise<ToolResult> {
    const { task_description, max_subtasks, include_dependencies } = args as {
      task_description: string
      max_subtasks?: number
      include_dependencies?: boolean
    }

    if (!task_description) {
      return { success: false, error: 'task_description is required' }
    }

    const maxTasks = max_subtasks || 5
    const withDeps = include_dependencies !== false

    try {
      // Simple task decomposition heuristics
      const tasks = this.decomposeTask(task_description, maxTasks, withDeps)

      return {
        success: true,
        result: {
          originalTask: task_description,
          tasks,
          totalTasks: tasks.length
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Simple task decomposition logic
  private decomposeTask(task: string, maxTasks: number, withDeps: boolean): Array<{
    id: string
    description: string
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>
    dependencies: string[]
  }> {
    const task_lower = task.toLowerCase()
    const tasks: Array<{
      id: string
      description: string
      toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>
      dependencies: string[]
    }> = []

    let taskId = 1

    // Heuristic decomposition based on keywords
    if (task_lower.includes('read') || task_lower.includes('analyze') || task_lower.includes('review')) {
      tasks.push({
        id: String(taskId++),
        description: 'Read/analyze source files',
        toolCalls: [{ name: 'dir_list', arguments: { recursive: true } }],
        dependencies: []
      })

      if (task_lower.includes('code') || task_lower.includes('function')) {
        tasks.push({
          id: String(taskId++),
          description: 'Extract relevant code sections',
          toolCalls: [{ name: 'grep_search', arguments: { pattern: 'function|class|const|let' } }],
          dependencies: ['1']
        })
      }
    }

    if (task_lower.includes('create') || task_lower.includes('write') || task_lower.includes('generate')) {
      tasks.push({
        id: String(taskId++),
        description: 'Plan file structure',
        toolCalls: [{ name: 'project_tree', arguments: {} }],
        dependencies: []
      })

      tasks.push({
        id: String(taskId++),
        description: 'Write/Update files',
        toolCalls: [{ name: 'file_write', arguments: { file_path: '', content: '' } }],
        dependencies: [String(taskId - 2)]
      })
    }

    if (task_lower.includes('build') || task_lower.includes('compile') || task_lower.includes('run')) {
      tasks.push({
        id: String(taskId++),
        description: 'Execute build/run command',
        toolCalls: [{ name: 'bash_execute', arguments: { command: '' } }],
        dependencies: []
      })
    }

    if (task_lower.includes('test')) {
      tasks.push({
        id: String(taskId++),
        description: 'Run tests',
        toolCalls: [{ name: 'bash_execute', arguments: { command: 'npm test' } }],
        dependencies: []
      })
    }

    if (task_lower.includes('deploy') || task_lower.includes('release')) {
      tasks.push({
        id: String(taskId++),
        description: 'Prepare deployment',
        toolCalls: [{ name: 'bash_execute', arguments: { command: '' } }],
        dependencies: []
      })
    }

    // If no tasks were identified, create a default task
    if (tasks.length === 0) {
      tasks.push({
        id: '1',
        description: task,
        toolCalls: [{ name: 'bash_execute', arguments: { command: `echo "Task: ${task}"` } }],
        dependencies: []
      })
    }

    // Limit to maxTasks
    return tasks.slice(0, maxTasks)
  }
}

interface TreeNode {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: TreeNode[]
}
