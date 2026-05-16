/**
 * Tool Registry - Pluggable tool registration system
 * Inspired by hermes-agent's tools/registry.py
 */

export * from './types'
export { ToolRegistry, getToolRegistry, initToolRegistry } from './toolRegistry'
export { registerTool, getToolMetadata, getAllToolMetadata, hasToolMetadata } from './decorators'

// Re-export tool executor type for convenience
export type { ToolExecutor } from './types'

// Tool sandbox integration
export { setToolSandbox, getToolSandbox } from './toolRegistry'
