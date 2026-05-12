/**
 * Computer Service - Sandbox Environment for Code Execution
 * 
 * Provides isolated execution environments for running untrusted code
 * with support for multiple languages, filesystem isolation, and network control.
 */

// Types
export * from './types';

// Sandbox Environment
export { SandboxEnv, SandboxEnvManager, sandboxManager } from './sandboxEnv';

// Code Executor
export { CodeExecutor, executeDirect } from './codeExecutor';

// Virtual File System
export { VirtualFileSystem, createSandboxFS } from './fileSystem';

// Network Guard
export { NetworkGuard, createSandboxNetworkGuard } from './networkGuard';

// Convenience re-exports for common use cases
import { SandboxEnvManager, sandboxManager } from './sandboxEnv';
import { CodeExecutor } from './codeExecutor';
import { VirtualFileSystem, createSandboxFS } from './fileSystem';
import { NetworkGuard, createSandboxNetworkGuard } from './networkGuard';
import { SandboxConfig, CodeExecution, ExecutionResult } from './types';

/**
 * Create a fully configured sandbox environment
 */
export async function createSandbox(config: SandboxConfig): Promise<{
  sandbox: InstanceType<typeof SandboxEnvManager> extends infer S ? S extends SandboxEnvManager ? InstanceType<typeof import('./sandboxEnv').SandboxEnv> : never : never;
  executor: CodeExecutor;
  fs: VirtualFileSystem;
  network: NetworkGuard;
}> {
  const sandbox = await sandboxManager.createSandbox(config);
  const executor = new CodeExecutor(sandbox);
  const fs = createSandboxFS('/tmp/sandbox-' + config.id);
  const network = createSandboxNetworkGuard();

  return { sandbox, executor, fs, network };
}

/**
 * Execute code in a temporary sandbox
 */
export async function executeInSandbox(
  code: string,
  language: 'python' | 'javascript' | 'shell',
  config?: Partial<SandboxConfig>
): Promise<ExecutionResult> {
  const fullConfig: SandboxConfig = {
    id: `temp-${Date.now()}`,
    name: 'temp-sandbox',
    timeout: config?.timeout || 30000,
    memoryLimit: config?.memoryLimit || 256,
    diskLimit: config?.diskLimit || 100,
    networkEnabled: config?.networkEnabled ?? false,
    allowedDomains: config?.allowedDomains || [],
    maxProcesses: config?.maxProcesses || 10,
    ...config
  };

  const { executor, sandbox } = await createSandbox(fullConfig);
  
  try {
    return await executor.execute({ code, language });
  } finally {
    await sandboxManager.destroySandbox(fullConfig.id);
  }
}

// Re-export SandboxEnv type for convenience
export type { SandboxConfig, ExecutionResult, CodeExecution } from './types';
