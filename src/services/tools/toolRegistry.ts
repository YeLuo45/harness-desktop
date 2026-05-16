/**
 * ToolRegistry - Pluggable tool registration system
 * Inspired by hermes-agent's tools/registry.py
 */

import {
  type ToolRegistryEntry,
  type ToolRegistryEntryInput,
  type ToolQuery,
  type ToolExecutor,
  type ToolCategory,
  generateToolId,
  BUILT_IN_TOOLS
} from './types'
import type { ToolDefinition } from '../../types'

export class ToolRegistry {
  private tools: Map<string, ToolRegistryEntry> = new Map()

  constructor() {
    // Do not auto-register built-in tools here - use initToolRegistry()
  }

  /**
   * Register a tool
   */
  register(input: ToolRegistryEntryInput): string {
    // Check for duplicate name
    if (this.tools.has(input.name)) {
      throw new Error(`Tool '${input.name}' is already registered`)
    }

    const id = generateToolId()
    const now = Date.now()

    const entry: ToolRegistryEntry = {
      ...input,
      id,
      enabled: input.enabled !== false, // Default to true
      registeredAt: now,
      updatedAt: now
    }

    this.tools.set(input.name, entry)
    console.log(`[ToolRegistry] Registered tool: ${input.name} (${id})`)
    return id
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const deleted = this.tools.delete(name)
    if (deleted) {
      console.log(`[ToolRegistry] Unregistered tool: ${name}`)
    }
    return deleted
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolRegistryEntry | null {
    return this.tools.get(name) || null
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolRegistryEntry[] {
    return Array.from(this.tools.values())
  }

  /**
   * List all tool names (alias for backward compatibility)
   */
  list(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * Query tools with filters
   */
  query(query: ToolQuery): ToolRegistryEntry[] {
    let results = Array.from(this.tools.values())

    if (query.category !== undefined) {
      results = results.filter(t => t.category === query.category)
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(t =>
        query.tags!.some(tag => t.tags.includes(tag))
      )
    }

    if (query.enabled !== undefined) {
      results = results.filter(t => t.enabled === query.enabled)
    }

    if (query.search) {
      const search = query.search.toLowerCase()
      results = results.filter(
        t =>
          t.name.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search)
      )
    }

    return results
  }

  /**
   * Get available tools for LLM (enabled tools only)
   */
  getAvailableTools(): ToolDefinition[] {
    return this.getAll()
      .filter(t => t.enabled)
      .map(t => t.definition)
  }

  /**
   * Enable a tool
   */
  enable(name: string): boolean {
    const entry = this.tools.get(name)
    if (!entry) return false

    entry.enabled = true
    entry.updatedAt = Date.now()
    console.log(`[ToolRegistry] Enabled tool: ${name}`)
    return true
  }

  /**
   * Disable a tool
   */
  disable(name: string): boolean {
    const entry = this.tools.get(name)
    if (!entry) return false

    entry.enabled = false
    entry.updatedAt = Date.now()
    console.log(`[ToolRegistry] Disabled tool: ${name}`)
    return true
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * Get statistics by category
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    const toolsArray = Array.from(this.tools.values())
    for (const tool of toolsArray) {
      stats[tool.category] = (stats[tool.category] || 0) + 1
    }
    return stats
  }

  /**
   * Register multiple tools at once
   */
  registerBatch(inputs: ToolRegistryEntryInput[]): string[] {
    return inputs.map(input => this.register(input))
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear()
    console.log('[ToolRegistry] Cleared all tools')
  }

  /**
   * Execute a tool by name
   */
  async execute(name: string, args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const entry = this.get(name)

    if (!entry) {
      return { success: false, error: `Tool '${name}' not found` }
    }

    if (!entry.enabled) {
      return { success: false, error: `Tool '${name}' is disabled` }
    }

    try {
      const executor = await entry.factory()
      const result = await executor.execute(args)

      // Run validation if present
      if (executor.validate) {
        const validation = executor.validate(args)
        if (!validation.valid) {
          return { success: false, error: `Validation failed: ${validation.errors?.join(', ')}` }
        }
      }

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Discover and register tools from a directory
   * Scans for tool modules and registers them
   */
  async discover(dirPath: string): Promise<number> {
    let count = 0
    
    try {
      // Dynamic import of fs for directory scanning
      const fs = await import('fs')
      const path = await import('path')
      
      if (!fs.readdirSync) {
        console.warn('[ToolRegistry] discover: fs not available')
        return 0
      }

      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.ts')) {
          try {
            // Try to import the module
            const modulePath = path.resolve(dirPath, entry.name)
            const module = await import(modulePath)
            
            // Look for tool definitions and executors
            if (module.fileToolDefinitions && module.fileToolExecutors) {
              // Register file tools
              const defs = module.fileToolDefinitions as Array<{
                name: string
                description: string
                parameters: any
                category: string
                tags: string[]
              }>
              const execs = module.fileToolExecutors as Record<string, () => Promise<ToolExecutor>>
              
              for (const def of defs) {
                const executorFactory = execs[def.name]
                if (executorFactory && !this.has(def.name)) {
                  this.register({
                    name: def.name,
                    description: def.description,
                    version: '1.0.0',
                    definition: {
                      name: def.name,
                      description: def.description,
                      parameters: def.parameters as any
                    },
                    factory: executorFactory,
                    category: def.category as ToolCategory,
                    tags: def.tags
                  })
                  count++
                }
              }
            }
            
            if (module.terminalToolDefinitions && module.terminalToolExecutors) {
              // Register terminal tools
              const defs = module.terminalToolDefinitions as Array<{
                name: string
                description: string
                parameters: any
                category: string
                tags: string[]
              }>
              const execs = module.terminalToolExecutors as Record<string, () => Promise<ToolExecutor>>
              
              for (const def of defs) {
                const executorFactory = execs[def.name]
                if (executorFactory && !this.has(def.name)) {
                  this.register({
                    name: def.name,
                    description: def.description,
                    version: '1.0.0',
                    definition: {
                      name: def.name,
                      description: def.description,
                      parameters: def.parameters as any
                    },
                    factory: executorFactory,
                    category: def.category as ToolCategory,
                    tags: def.tags
                  })
                  count++
                }
              }
            }
          } catch (err) {
            console.warn(`[ToolRegistry] Failed to load tool module ${entry.name}:`, err)
          }
        }
      }
      
      console.log(`[ToolRegistry] Discovered ${count} tools from ${dirPath}`)
    } catch (err) {
      console.warn(`[ToolRegistry] discover: Error scanning directory ${dirPath}:`, err)
    }
    
    return count
  }
}

// Singleton instance
let toolRegistryInstance: ToolRegistry | null = null

/**
 * Get the singleton ToolRegistry instance
 */
export function getToolRegistry(): ToolRegistry {
  if (!toolRegistryInstance) {
    toolRegistryInstance = new ToolRegistry()
  }
  return toolRegistryInstance
}

/**
 * Initialize ToolRegistry with built-in tools
 */
export function initToolRegistry(): ToolRegistry {
  const registry = getToolRegistry()

  // Register built-in tools
  for (const tool of BUILT_IN_TOOLS) {
    if (!registry.has(tool.name)) {
      registry.register(tool)
    }
  }

  console.log(`[ToolRegistry] Initialized with ${BUILT_IN_TOOLS.length} built-in tools`)
  return registry
}

// Tool sandbox instance for tool execution pipeline integration
let toolSandboxInstance: import('./toolSandbox').ToolSandbox | null = null

/**
 * Set the tool sandbox instance
 */
export function setToolSandbox(sandbox: import('./toolSandbox').ToolSandbox): void {
  toolSandboxInstance = sandbox
  console.log('[ToolRegistry] Tool sandbox configured')
}

/**
 * Get the tool sandbox instance
 */
export function getToolSandbox(): import('./toolSandbox').ToolSandbox | null {
  return toolSandboxInstance
}
