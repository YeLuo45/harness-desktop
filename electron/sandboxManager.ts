import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

interface ValidationResult {
  valid: boolean
  resolved?: string
  error?: string
}

interface ExecutionResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

export class SandboxManager {
  private workDir: string
  private dangerousCommands: string[]
  private allowedExtensions: string[]
  private initialized = true

  constructor(workDir: string, dangerousCommands: string[], allowedExtensions: string[]) {
    this.workDir = workDir
    this.dangerousCommands = dangerousCommands
    this.allowedExtensions = allowedExtensions

    // Ensure work directory exists
    if (!fs.existsSync(this.workDir)) {
      try {
        fs.mkdirSync(this.workDir, { recursive: true })
      } catch (error) {
        console.error('[SandboxManager] Failed to create work dir:', error)
        this.initialized = false
      }
    }
  }

  getWorkDir(): string {
    return this.workDir
  }

  getStatus() {
    return {
      initialized: this.initialized,
      workDir: this.workDir,
      dangerousCommandsCount: this.dangerousCommands.length
    }
  }

  validatePath(filePath: string): ValidationResult {
    try {
      // Resolve relative paths against work directory
      const resolved = path.isAbsolute(filePath)
        ? path.resolve(filePath)
        : path.resolve(this.workDir, filePath)

      // Check if resolved path is within work directory
      if (!resolved.startsWith(this.workDir)) {
        return {
          valid: false,
          error: `Path "${filePath}" is outside the allowed working directory`
        }
      }

      // Check file extension if it's a file (has extension)
      const ext = path.extname(filePath).toLowerCase()
      if (ext && !this.allowedExtensions.includes(ext)) {
        return {
          valid: false,
          error: `File extension "${ext}" is not allowed. Allowed: ${this.allowedExtensions.join(', ')}`
        }
      }

      return { valid: true, resolved }
    } catch (error: any) {
      return { valid: false, error: error.message }
    }
  }

  validateCommand(command: string): ValidationResult {
    const lowerCommand = command.toLowerCase().trim()

    // Check for dangerous commands
    for (const dangerous of this.dangerousCommands) {
      if (lowerCommand.includes(dangerous.toLowerCase())) {
        return {
          valid: false,
          error: `Command contains forbidden pattern: "${dangerous}"`
        }
      }
    }

    // Block network commands
    const networkCommands = ['curl ', 'wget ', 'nc ', 'netcat ', 'ssh ', 'telnet ']
    for (const netCmd of networkCommands) {
      if (lowerCommand.includes(netCmd)) {
        return {
          valid: false,
          error: `Network commands are not allowed in sandbox: "${netCmd.trim()}"`
        }
      }
    }

    // Block attempts to escape work directory
    if (lowerCommand.includes('cd ..') || lowerCommand.includes('cd../')) {
      // Allow cd .. only if followed by a path within workDir
      if (!lowerCommand.includes(this.workDir)) {
        return {
          valid: false,
          error: 'Cannot navigate outside working directory'
        }
      }
    }

    return { valid: true }
  }

  async executeCommand(command: string, timeoutMs: number = 30000): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      // Use cmd.exe on Windows with proper encoding
      const isWindows = process.platform === 'win32'
      
      let shell: string
      let shellArgs: string[]

      if (isWindows) {
        // Use cmd.exe with /c flag, chcp to UTF-8
        shell = 'cmd.exe'
        shellArgs = ['/c', `chcp 65066 >nul 2>&1 && ${command}`]
      } else {
        shell = '/bin/sh'
        shellArgs = ['-c', command]
      }

      const proc = spawn(shell, shellArgs, {
        cwd: this.workDir,
        env: {
          ...process.env,
          // Restrict environment variables
          HOME: this.workDir,
          TMPDIR: this.workDir
        },
        timeout: timeoutMs,
        windowsHide: true
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

  updateWorkDir(newDir: string) {
    this.workDir = newDir
  }
}
