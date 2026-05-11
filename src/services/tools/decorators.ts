/**
 * Tool Registry Decorators
 * Provides decorator-based tool registration
 */

export interface ToolMetadata {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  category?: string
  tags?: string[]
}

// Store tool metadata by method name (using a Map since we need string keys)
const toolMetadataStore = new Map<string, ToolMetadata>()

/**
 * Register a method as a tool handler
 * @param config - Partial tool definition
 */
export function registerTool(config: Partial<ToolMetadata>): any {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    if (!descriptor.value) {
      return descriptor
    }

    const key = String(propertyKey)
    const metadata: ToolMetadata = {
      name: config.name || key,
      description: config.description || '',
      parameters: config.parameters || { type: 'object', properties: {} },
      category: config.category,
      tags: config.tags
    }

    // Store metadata with the method name as key
    toolMetadataStore.set(key, metadata)

    return descriptor
  }
}

/**
 * Extract tool metadata from a decorated method by name
 */
export function getToolMetadata(methodName: string): ToolMetadata | undefined {
  return toolMetadataStore.get(methodName)
}

/**
 * Get all registered tool metadata
 */
export function getAllToolMetadata(): ToolMetadata[] {
  return Array.from(toolMetadataStore.values())
}

/**
 * Check if a method has tool metadata
 */
export function hasToolMetadata(methodName: string): boolean {
  return toolMetadataStore.has(methodName)
}
