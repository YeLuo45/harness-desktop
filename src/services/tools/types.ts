/**
 * Tool Registry Types
 * Inspired by hermes-agent's tools/registry.py
 */

import type { ToolDefinition, ToolExecutionResult } from '../../types'

// 工具分类
export type ToolCategory =
  | 'file'
  | 'bash'
  | 'search'
  | 'web'
  | 'memory'
  | 'code'
  | 'custom'

// 工具执行器接口
export interface ToolExecutor {
  execute(args: Record<string, unknown>): Promise<ToolExecutionResult>
  validate?(args: Record<string, unknown>): ValidationResult
}

// 验证结果
export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

// 工具工厂函数
export type ToolFactory = () => ToolExecutor | Promise<ToolExecutor>

// 工具注册项
export interface ToolRegistryEntry {
  id: string
  name: string
  description: string
  version: string

  // 工具定义（供 LLM 使用）
  definition: ToolDefinition

  // 工厂函数
  factory: ToolFactory

  // 生命周期
  registeredAt: number
  updatedAt: number
  enabled: boolean

  // 分类
  category: ToolCategory
  tags: string[]
}

// 工具查询条件
export interface ToolQuery {
  category?: ToolCategory
  tags?: string[]
  enabled?: boolean
  search?: string  // 搜索名称/描述
}

// 创建注册项（不含自动生成的字段）
// enabled 在 register 时有默认值，所以这里设为可选
export type ToolRegistryEntryInput = Omit<ToolRegistryEntry, 'id' | 'registeredAt' | 'updatedAt' | 'enabled'> & Partial<Pick<ToolRegistryEntry, 'enabled'>>

/**
 * 生成唯一 ID
 */
export function generateToolId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * 内置工具定义
 */
export const BUILT_IN_TOOLS: ToolRegistryEntryInput[] = [
  {
    name: 'file_read',
    description: 'Read contents of a file',
    version: '1.0.0',
    definition: {
      name: 'file_read',
      description: 'Read contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' }
        },
        required: ['path']
      }
    },
    factory: async () => ({
      execute: async (args) => {
        // Actual implementation would use fs
        return { success: true, result: `Content of ${args.path}` }
      }
    }),
    category: 'file',
    tags: ['io', 'read']
  },
  {
    name: 'file_write',
    description: 'Write content to a file',
    version: '1.0.0',
    definition: {
      name: 'file_write',
      description: 'Write content to a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
          content: { type: 'string', description: 'Content to write' }
        },
        required: ['path', 'content']
      }
    },
    factory: async () => ({
      execute: async (args) => {
        // Actual implementation would use fs
        return { success: true, result: `Wrote to ${args.path}` }
      }
    }),
    category: 'file',
    tags: ['io', 'write']
  },
  {
    name: 'bash_execute',
    description: 'Execute a bash command',
    version: '1.0.0',
    definition: {
      name: 'bash_execute',
      description: 'Execute a bash command',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The bash command to execute' }
        },
        required: ['command']
      }
    },
    factory: async () => ({
      execute: async (args) => {
        // Actual implementation would use child_process
        return { success: true, result: `Executed: ${args.command}` }
      }
    }),
    category: 'bash',
    tags: ['shell', 'execute']
  },
  {
    name: 'web_search',
    description: 'Search the web',
    version: '1.0.0',
    definition: {
      name: 'web_search',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' }
        },
        required: ['query']
      }
    },
    factory: async () => ({
      execute: async (args) => {
        // Actual implementation would use search API
        return { success: true, result: `Search results for: ${args.query}` }
      }
    }),
    category: 'search',
    tags: ['web', 'search']
  },
  {
    name: 'memory_store',
    description: 'Store information in long-term memory',
    version: '1.0.0',
    definition: {
      name: 'memory_store',
      description: 'Store information in long-term memory',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Content to store' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags for the memory' }
        },
        required: ['content']
      }
    },
    factory: async () => ({
      execute: async (args) => {
        // Actual implementation would use LongTermMemoryService
        return { success: true, result: 'Stored in memory' }
      }
    }),
    category: 'memory',
    tags: ['memory', 'store']
  },
  {
    name: 'memory_recall',
    description: 'Recall information from long-term memory',
    version: '1.0.0',
    definition: {
      name: 'memory_recall',
      description: 'Recall information from long-term memory',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query to recall' },
          limit: { type: 'number', description: 'Maximum results to return' }
        },
        required: ['query']
      }
    },
    factory: async () => ({
      execute: async (args) => {
        // Actual implementation would use LongTermMemoryService
        return { success: true, result: `Recalled: ${args.query}` }
      }
    }),
    category: 'memory',
    tags: ['memory', 'recall']
  }
]