import { SandboxConfig, SandboxResult, SandboxResultStatus, DEFAULT_SANDBOX_CONFIG } from './resourceTypes'
import { executionContextManager } from './executionContext'

const generateId = (): string => Math.random().toString(36).substring(2, 15)

export class Sandbox {
  private configs: Map<string, SandboxConfig> = new Map()
  private executionHistory: Map<string, SandboxResult[]> = new Map()

  createSandbox(agentId: string, config?: Partial<SandboxConfig>): SandboxConfig {
    const fullConfig: SandboxConfig = { ...DEFAULT_SANDBOX_CONFIG, ...config }
    this.configs.set(agentId, fullConfig)
    return fullConfig
  }

  getConfig(agentId: string): SandboxConfig | undefined {
    return this.configs.get(agentId)
  }

  updateConfig(agentId: string, updates: Partial<SandboxConfig>): SandboxConfig | undefined {
    const current = this.configs.get(agentId)
    if (!current) return undefined
    const updated = { ...current, ...updates }
    this.configs.set(agentId, updated)
    return updated
  }

  removeSandbox(agentId: string): boolean {
    return this.configs.delete(agentId)
  }

  async executeInSandbox(
    agentId: string,
    code: string,
    context?: Record<string, unknown>
  ): Promise<SandboxResult> {
    const config = this.configs.get(agentId) || DEFAULT_SANDBOX_CONFIG
    const startTime = Date.now()

    // Create execution context
    const execContext = executionContextManager.createContext(agentId)

    try {
      // Simulate sandbox execution with timeout
      const result = await Promise.race([
        this.executeCode(code, context, config),
        this.createTimeoutPromise(config.timeoutMs)
      ])

      const executionTime = Date.now() - startTime
      const sandboxResult: SandboxResult = {
        status: SandboxResultStatus.SUCCESS,
        output: result as string,
        executionTimeMs: executionTime,
        memoryUsedMB: Math.random() * config.maxMemoryMB * 0.5,
        cpuTimeMs: executionTime
      }

      this.recordExecution(agentId, sandboxResult)
      return sandboxResult
    } catch (error) {
      const executionTime = Date.now() - startTime
      let status = SandboxResultStatus.ERROR
      let errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (errorMessage === 'TIMEOUT') {
        status = SandboxResultStatus.TIMEOUT
        errorMessage = `Execution timed out after ${config.timeoutMs}ms`
      }

      const sandboxResult: SandboxResult = {
        status,
        error: errorMessage,
        executionTimeMs: executionTime,
        memoryUsedMB: 0,
        cpuTimeMs: executionTime
      }

      this.recordExecution(agentId, sandboxResult)
      executionContextManager.deactivateContext(execContext.id)
      return sandboxResult
    }
  }

  private async executeCode(
    code: string,
    context: Record<string, unknown> | undefined,
    config: SandboxConfig
  ): Promise<string> {
    // In a real implementation, this would use a sandboxed runtime
    // For demo purposes, we simulate execution
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simple code evaluation simulation
        try {
          // In real sandbox, we'd use Web Workers + restricted eval
          const mockResult = `Executed in sandbox: ${code.substring(0, 50)}...`
          resolve(mockResult)
        } catch {
          resolve('Code executed with warnings')
        }
      }, 100)
    })
  }

  private createTimeoutPromise(ms: number): Promise<string> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    })
  }

  private recordExecution(agentId: string, result: SandboxResult): void {
    const history = this.executionHistory.get(agentId) || []
    history.push(result)
    // Keep last 100 executions
    if (history.length > 100) {
      history.shift()
    }
    this.executionHistory.set(agentId, history)
  }

  getExecutionHistory(agentId: string): SandboxResult[] {
    return this.executionHistory.get(agentId) || []
  }

  getExecutionStats(agentId: string): {
    total: number
    success: number
    failures: number
    avgExecutionTime: number
    timeoutRate: number
  } {
    const history = this.getExecutionHistory(agentId)
    if (history.length === 0) {
      return { total: 0, success: 0, failures: 0, avgExecutionTime: 0, timeoutRate: 0 }
    }

    const success = history.filter(r => r.status === SandboxResultStatus.SUCCESS).length
    const failures = history.filter(r =>
      r.status !== SandboxResultStatus.SUCCESS
    ).length
    const timeouts = history.filter(r => r.status === SandboxResultStatus.TIMEOUT).length
    const totalTime = history.reduce((sum, r) => sum + r.executionTimeMs, 0)

    return {
      total: history.length,
      success,
      failures,
      avgExecutionTime: totalTime / history.length,
      timeoutRate: timeouts / history.length
    }
  }
}

export const sandbox = new Sandbox()