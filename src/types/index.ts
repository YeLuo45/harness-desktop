export interface ElectronAPI {
  config: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<boolean>
    getAll: () => Promise<Record<string, unknown>>
  }
  systemPrompt: {
    getFixed: () => Promise<string>
    buildDynamic: (context: Record<string, unknown>) => Promise<string>
  }
  tool: {
    execute: (toolCall: ToolCall) => Promise<ToolExecutionResult>
  }
  sandbox: {
    getStatus: () => Promise<SandboxStatus>
  }
  dialog: {
    selectWorkDir: () => Promise<string | null>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
  }
  fs: {
    readDir: (dirPath: string) => Promise<FileEntry[] | { error: string }>
    readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
    writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
    exists: (filePath: string) => Promise<boolean>
  }
}

export interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

export interface ToolCall {
  name: string
  arguments: Record<string, unknown>
  riskLevel?: 'low' | 'medium' | 'high'
}

export interface ToolExecutionResult {
  success: boolean
  result?: unknown
  error?: string
}

export interface SandboxStatus {
  initialized: boolean
  workDir: string
  dangerousCommandsCount: number
}

// Store types
export type ToolCallMode = 'planning' | 'execution'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  plan?: ExecutionPlan
  mode?: ToolCallMode
}

export interface ToolResult {
  toolName: string
  arguments: Record<string, unknown>
  result: unknown
  success: boolean
  error?: string
  timestamp: number
}

export interface ExecutionPlan {
  taskDescription: string
  steps: PlanStep[]
  risks: string[]
  totalSteps: number
  confirmed: boolean
}

export interface PlanStep {
  id: string
  description: string
  toolName: string
  arguments: Record<string, unknown>
  riskLevel: 'low' | 'medium' | 'high'
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped'
  result?: unknown
  error?: string
}

export interface MemoryPointer {
  id: string
  type: 'user_input' | 'assistant_response' | 'tool_call' | 'tool_result'
  summary: string
  fullContent: string
  timestamp: number
  associations: string[] // Related pointer IDs
}

export interface AppConfig {
  apiKey: string
  model: ModelProvider
  modelEndpoint: string
  modelName: string
  workDir: string
  contextWindow: number
  riskConfirmation: {
    medium: boolean
    high: boolean
  }
}

export type ModelProvider = 'openai' | 'minimax' | 'glm' | 'xiaomi' | 'qwen'

export interface ModelAdapter {
  name: ModelProvider
  endpoint: string
  defaultModel: string
  stream(options: StreamOptions): Promise<void>
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>
}

export interface StreamOptions {
  messages: ChatMessage[]
  systemPrompt: string
  tools?: ToolDefinition[]
  onChunk: (chunk: string) => void
  onComplete: () => void
  onError: (error: Error) => void
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  toolCalls?: ToolCallSpec[]
  toolResults?: ToolResultSpec[]
}

export interface ToolCallSpec {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResultSpec {
  toolCallId: string
  result: unknown
  success: boolean
  error?: string
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]
}

export interface ChatResponse {
  content: string
  toolCalls?: ToolCallSpec[]
  finishReason: 'stop' | 'tool_calls' | 'length'
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParamDef>
    required?: string[]
  }
}

export interface ToolParamDef {
  type: string
  description?: string
  enum?: string[]
}
