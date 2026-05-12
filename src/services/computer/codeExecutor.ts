/**
 * Code Executor
 * Handles execution of Python, JavaScript, and Shell code in sandboxed environments
 */

import { spawn, ChildProcess } from 'child_process';
import { CodeExecution, ExecutionResult, Language } from './types';
import { SandboxEnv } from './sandboxEnv';

export class CodeExecutor {
  private sandbox: SandboxEnv;

  constructor(sandbox: SandboxEnv) {
    this.sandbox = sandbox;
  }

  /**
   * Execute code in the sandbox
   */
  async execute(execution: CodeExecution): Promise<ExecutionResult> {
    const id = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();
    const timeout = execution.timeout || 30000;

    const result: ExecutionResult = {
      id,
      sandboxId: this.sandbox.id,
      language: execution.language,
      exitCode: null,
      stdout: '',
      stderr: '',
      duration: 0,
      startTime,
      endTime: null,
      status: 'pending'
    };

    try {
      result.status = 'running';
      const childProcess = await this.runProcess(execution, timeout);
      
      result.exitCode = childProcess.exitCode;
      result.duration = Date.now() - startTime.getTime();
      result.endTime = new Date();
      result.status = childProcess.exitCode === 0 ? 'completed' : 'failed';

      this.sandbox.unregisterProcess(childProcess.pid!);
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      result.endTime = new Date();
      result.duration = Date.now() - startTime.getTime();
    }

    return result;
  }

  private runProcess(execution: CodeExecution, timeout: number): Promise<{ pid: number; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
      const { command, args } = this.getExecutionCommand(execution);
      
      const child = spawn(command, args, {
        cwd: execution.workingDir || '/tmp',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...this.sandbox['config'].env }
      });

      this.sandbox.registerProcess(child.pid!);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          pid: child.pid!,
          exitCode: code
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      if (execution.stdin) {
        child.stdin?.write(execution.stdin);
        child.stdin?.end();
      }
    });
  }

  private getExecutionCommand(execution: CodeExecution): { command: string; args: string[] } {
    switch (execution.language) {
      case 'python':
        return {
          command: 'python3',
          args: ['-c', execution.code]
        };
      case 'javascript':
        return {
          command: 'node',
          args: ['-e', execution.code]
        };
      case 'shell':
        return {
          command: 'sh',
          args: ['-c', execution.code]
        };
      default:
        throw new Error(`Unsupported language: ${execution.language}`);
    }
  }

  /**
   * Execute Python code
   */
  async executePython(code: string, timeout?: number): Promise<ExecutionResult> {
    return this.execute({ code, language: 'python', timeout });
  }

  /**
   * Execute JavaScript code
   */
  async executeJavaScript(code: string, timeout?: number): Promise<ExecutionResult> {
    return this.execute({ code, language: 'javascript', timeout });
  }

  /**
   * Execute Shell code
   */
  async executeShell(code: string, timeout?: number): Promise<ExecutionResult> {
    return this.execute({ code, language: 'shell', timeout });
  }
}

/**
 * Execute code without a sandbox (for trusted environments)
 */
export async function executeDirect(
  code: string,
  language: Language,
  timeout: number = 30000
): Promise<ExecutionResult> {
  const id = `direct-${Date.now()}`;
  const startTime = new Date();

  return new Promise((resolve) => {
    const { command, args } = getDirectCommand(code, language);
    
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({
        id,
        sandboxId: 'direct',
        language,
        exitCode: null,
        stdout,
        stderr,
        duration: timeout,
        startTime,
        endTime: new Date(),
        status: 'timeout',
        error: 'Execution timeout'
      });
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        id,
        sandboxId: 'direct',
        language,
        exitCode: code,
        stdout,
        stderr,
        duration: Date.now() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        status: code === 0 ? 'completed' : 'failed'
      });
    });
  });
}

function getDirectCommand(code: string, language: Language): { command: string; args: string[] } {
  switch (language) {
    case 'python':
      return { command: 'python3', args: ['-c', code] };
    case 'javascript':
      return { command: 'node', args: ['-e', code] };
    case 'shell':
      return { command: 'sh', args: ['-c', code] };
  }
}
