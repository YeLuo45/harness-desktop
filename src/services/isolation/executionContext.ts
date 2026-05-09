import { ExecutionContext, ResourceUsage } from './resourceTypes'

const generateId = (): string => Math.random().toString(36).substring(2, 15)

export class ExecutionContextManager {
  private contexts: Map<string, ExecutionContext> = new Map()
  private agentToContext: Map<string, string> = new Map()

  createContext(agentId: string): ExecutionContext {
    // Destroy existing context if any
    const existing = this.agentToContext.get(agentId)
    if (existing) {
      this.destroyContext(existing)
    }

    const id = generateId()
    const context: ExecutionContext = {
      id,
      agentId,
      createdAt: Date.now(),
      isActive: true,
      usage: {
        memoryUsedMB: 0,
        cpuTimeUsedMs: 0,
        execTimeUsedMs: 0,
        fileSizeUsedMB: 0,
        networkCalls: 0,
        timestamp: Date.now()
      }
    }

    this.contexts.set(id, context)
    this.agentToContext.set(agentId, id)
    return context
  }

  getContext(contextId: string): ExecutionContext | undefined {
    return this.contexts.get(contextId)
  }

  getContextByAgent(agentId: string): ExecutionContext | undefined {
    const contextId = this.agentToContext.get(agentId)
    return contextId ? this.contexts.get(contextId) : undefined
  }

  getAllContexts(): ExecutionContext[] {
    return Array.from(this.contexts.values())
  }

  getActiveContexts(): ExecutionContext[] {
    return Array.from(this.contexts.values()).filter(c => c.isActive)
  }

  updateUsage(contextId: string, usage: Partial<ResourceUsage>): void {
    const context = this.contexts.get(contextId)
    if (context) {
      context.usage = { ...context.usage, ...usage, timestamp: Date.now() }
    }
  }

  deactivateContext(contextId: string): void {
    const context = this.contexts.get(contextId)
    if (context) {
      context.isActive = false
      this.agentToContext.delete(context.agentId)
    }
  }

  destroyContext(contextId: string): boolean {
    const context = this.contexts.get(contextId)
    if (!context) return false

    this.agentToContext.delete(context.agentId)
    return this.contexts.delete(contextId)
  }

  destroyContextByAgent(agentId: string): boolean {
    const contextId = this.agentToContext.get(agentId)
    if (contextId) {
      this.agentToContext.delete(agentId)
      return this.contexts.delete(contextId)
    }
    return false
  }

  getContextStats(): { total: number; active: number; totalMemory: number; totalCpu: number } {
    const contexts = Array.from(this.contexts.values())
    return {
      total: contexts.length,
      active: contexts.filter(c => c.isActive).length,
      totalMemory: contexts.reduce((sum, c) => sum + c.usage.memoryUsedMB, 0),
      totalCpu: contexts.reduce((sum, c) => sum + c.usage.cpuTimeUsedMs, 0)
    }
  }
}

export const executionContextManager = new ExecutionContextManager()