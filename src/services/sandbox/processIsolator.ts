/**
 * Process Isolator - Handles timeout, resource limits, and child process cleanup
 */

import { spawn, ChildProcess } from 'child_process';
import { AuditEntry, ProcessIsolatorConfig, AuditEventType } from './types';
import { getPlatformImpl } from '../../../../src/services/platform/platformDetect';

export class ProcessIsolator {
  private config: ProcessIsolatorConfig;
  private childProcess: ChildProcess | null = null;
  private timer: NodeJS.Timeout | null = null;
  private killed = false;

  constructor(config: ProcessIsolatorConfig) {
    this.config = config;
  }

  /**
   * Execute a command with resource limits
   */
  async execute(
    command: string,
    args: string[],
    onAudit: (entry: AuditEntry) => void
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    killed: boolean;
    signal?: string;
    executionTime: number;
  }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let exitCode: number | null = null;

      const spawnOpts: any = {
        cwd: this.config.workingDirectory || process.cwd(),
        env: { ...process.env, ...this.config.env },
        shell: true,
      };

      // Set up resource limits using v8 limits if available
      if (this.config.memoryLimit) {
        // Note: Node.js doesn't directly support memory limits
        // This would require OS-level cgroups or containerization
      }

      onAudit({
        timestamp: new Date().toISOString(),
        event: 'PROCESS_START' as AuditEventType,
        details: `Starting process: ${command} ${args.join(' ')}`,
      });

      try {
        this.childProcess = spawn(command, args, spawnOpts);
      } catch (error: any) {
        resolve({
          stdout: '',
          stderr: `Failed to spawn process: ${error.message}`,
          exitCode: -1,
          killed: false,
          executionTime: Date.now() - startTime,
        });
        return;
      }

      const pid = this.childProcess.pid;

      // Set up timeout
      this.timer = setTimeout(() => {
        this.killed = true;
        this.kill('SIGKILL');
        onAudit({
          timestamp: new Date().toISOString(),
          event: 'TIMEOUT_EXCEEDED' as AuditEventType,
          details: `Process ${pid} killed due to timeout (${this.config.timeout}ms)`,
          resourceUsage: { duration: Date.now() - startTime },
        });
      }, this.config.timeout);

      this.childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      this.childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      this.childProcess.on('close', (code, signal) => {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }

        exitCode = code;
        const executionTime = Date.now() - startTime;

        if (this.killed) {
          onAudit({
            timestamp: new Date().toISOString(),
            event: 'PROCESS_KILLED' as AuditEventType,
            details: `Process ${pid} killed with signal ${signal || 'SIGKILL'}`,
            resourceUsage: { duration: executionTime },
          });
        } else {
          onAudit({
            timestamp: new Date().toISOString(),
            event: 'PROCESS_EXIT' as AuditEventType,
            details: `Process ${pid} exited with code ${code}`,
            resourceUsage: { duration: executionTime },
          });
        }

        this.childProcess = null;
        resolve({ stdout, stderr, exitCode, killed: this.killed, signal: signal || undefined, executionTime });
      });

      this.childProcess.on('error', (err) => {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        stderr += `Process error: ${err.message}`;
        resolve({ stdout, stderr, exitCode: -1, killed: false, executionTime: Date.now() - startTime });
      });
    });
  }

  /**
   * Kill the child process and all its descendants
   */
  kill(signal: string = 'SIGKILL'): void {
    if (!this.childProcess) return;

    this.killed = true;

    // Kill the process tree
    this.killProcessTree(this.childProcess.pid!, signal);
  }

  /**
   * Recursively kill a process and all its children
   */
  private killProcessTree(pid: number, signal: string): void {
    const platformImpl = getPlatformImpl();
    const isWindows = platformImpl.path.isWindows ? true : false;

    try {
      if (isWindows) {
        // Windows: use taskkill to kill process tree
        spawn('taskkill', ['/T', '/F', '/PID', pid.toString()], { stdio: 'ignore' });
      } else {
        // Unix-like (Linux/macOS): use pkill to kill child processes by parent
        spawn('pkill', ['-9', '-P', pid.toString()], { stdio: 'ignore' });
      }
    } catch {
      // Ignore errors
    }

    try {
      process.kill(pid, signal);
    } catch {
      // Process may already be dead
    }
  }

  /**
   * Get the current child process
   */
  getChildProcess(): ChildProcess | null {
    return this.childProcess;
  }

  /**
   * Check if the process was killed
   */
  wasKilled(): boolean {
    return this.killed;
  }
}
