/**
 * Sandbox Manager - Central orchestrator for sandbox execution
 */

import { SandboxConfig, SandboxResult, AuditEntry } from './types';
import { ProcessIsolator } from './processIsolator';
import { FileIsolator } from './fileIsolator';
import { NetworkIsolator } from './networkIsolator';
import { AuditLogger } from './auditLogger';

export class SandboxManager {
  private config: SandboxConfig;
  private processIsolator: ProcessIsolator;
  private fileIsolator: FileIsolator;
  private networkIsolator: NetworkIsolator;
  private auditLogger: AuditLogger;
  private auditEntries: AuditEntry[] = [];

  constructor(config: SandboxConfig, logFilePath?: string) {
    this.config = config;
    
    // Initialize process isolator
    this.processIsolator = new ProcessIsolator({
      timeout: config.timeout,
      memoryLimit: config.memoryLimit,
      cpuLimit: config.cpuLimit,
      workingDirectory: config.workingDirectory,
      env: config.env,
    });

    // Initialize file isolator
    this.fileIsolator = new FileIsolator({
      allowedPaths: config.allowedPaths,
      blockedPaths: config.blockedPaths,
      workingDirectory: config.workingDirectory,
    });

    // Initialize network isolator
    this.networkIsolator = new NetworkIsolator({
      allowNetwork: config.allowNetwork ?? false,
      dnsServers: config.dnsServers,
    });

    // Initialize audit logger
    const defaultLogPath = logFilePath || '/tmp/sandbox-audit.log';
    this.auditLogger = new AuditLogger(defaultLogPath);
  }

  /**
   * Execute a command in the sandbox
   */
  async execute(command: string, args: string[] = []): Promise<SandboxResult> {
    this.auditEntries = [];

    const handleAudit = (entry: AuditEntry): void => {
      this.auditEntries.push(entry);
      this.auditLogger.log(entry);
    };

    // Execute process with isolation
    const result = await this.processIsolator.execute(command, args, handleAudit);

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      executionTime: result.executionTime,
      killed: result.killed,
      signal: result.signal,
      auditEntries: [...this.auditEntries],
    };
  }

  /**
   * Validate file access
   */
  validateFileAccess(filePath: string, operation: string): boolean {
    return this.fileIsolator.validatePath(filePath, operation, (entry) => {
      this.auditEntries.push(entry);
      this.auditLogger.log(entry);
    });
  }

  /**
   * Validate network connection
   */
  validateNetworkAccess(host: string, port: number): boolean {
    return this.networkIsolator.validateConnection(host, port, (entry) => {
      this.auditEntries.push(entry);
      this.auditLogger.log(entry);
    });
  }

  /**
   * Check if a path is allowed
   */
  isPathAllowed(filePath: string): boolean {
    return this.fileIsolator.isPathAllowed(filePath);
  }

  /**
   * Check if network is allowed
   */
  isNetworkAllowed(): boolean {
    return this.networkIsolator.isNetworkAllowed();
  }

  /**
   * Get all audit entries for current session
   */
  getAuditEntries(): AuditEntry[] {
    return [...this.auditEntries];
  }

  /**
   * Get audit statistics
   */
  getAuditStatistics(): ReturnType<AuditLogger['getStatistics']> {
    return this.auditLogger.getStatistics();
  }

  /**
   * Close the sandbox and cleanup resources
   */
  close(): void {
    this.auditLogger.close();
  }

  /**
   * Get the process isolator
   */
  getProcessIsolator(): ProcessIsolator {
    return this.processIsolator;
  }

  /**
   * Get the file isolator
   */
  getFileIsolator(): FileIsolator {
    return this.fileIsolator;
  }

  /**
   * Get the network isolator
   */
  getNetworkIsolator(): NetworkIsolator {
    return this.networkIsolator;
  }

  /**
   * Get the audit logger
   */
  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }

  /**
   * Get the sandbox configuration
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }
}

/**
 * Create a sandbox manager with default configuration
 */
export function createSandbox(config?: Partial<SandboxConfig>): SandboxManager {
  const defaultConfig: SandboxConfig = {
    timeout: 30000,
    memoryLimit: 256 * 1024 * 1024, // 256MB
    cpuLimit: 80,
    allowNetwork: false,
    allowedPaths: [],
    blockedPaths: ['/etc', '/root', '/home'],
    dnsServers: ['8.8.8.8', '8.8.4.4'],
  };

  return new SandboxManager({ ...defaultConfig, ...config });
}
