import type {
  ModelProvider,
  ChatMessage,
  ChatResponse,
  StreamOptions,
  ToolDefinition,
  ToolCallSpec,
  ToolResultSpec
} from '../types'

export interface ModelAdapter {
  provider: ModelProvider
  chat(messages: ChatMessage[], systemPrompt: string, tools?: ToolDefinition[]): Promise<ChatResponse>
  stream(options: StreamOptions): void
}

// Base adapter with common functionality
abstract class BaseAdapter implements ModelAdapter {
  abstract provider: ModelProvider
  protected apiKey: string
  protected endpoint: string
  protected modelName: string

  constructor(apiKey: string, endpoint: string, modelName: string) {
    this.apiKey = apiKey
    this.endpoint = endpoint
    this.modelName = modelName
  }

  abstract chat(messages: ChatMessage[], systemPrompt: string, tools?: ToolDefinition[]): Promise<ChatResponse>
  abstract stream(options: StreamOptions): void

  protected async fetchWithTimeout(url: string, options: RequestInit, timeout = 60000): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }
}

// OpenAI compatible adapter
class OpenAIAdapter extends BaseAdapter {
  provider: ModelProvider = 'openai'

  async chat(messages: ChatMessage[], systemPrompt: string, tools?: ToolDefinition[]): Promise<ChatResponse> {
    const allMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ]

    const requestBody: any = {
      model: this.modelName,
      messages: allMessages.map(m => ({
        role: m.role,
        content: m.content,
        tool_calls: m.toolCalls,
        tool_call_id: (m as any).toolCallId
      })),
      stream: false
    }

    if (tools && tools.length > 0) {
      requestBody.tools = tools
      requestBody.tool_choice = 'auto'
    }

    const response = await this.fetchWithTimeout(
      `${this.endpoint}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    const choice = data.choices[0]

    return {
      content: choice.message?.content || '',
      toolCalls: choice.message?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function?.name,
        arguments: JSON.parse(tc.function?.arguments || '{}')
      })),
      finishReason: choice.finish_reason
    }
  }

  stream(options: StreamOptions): void {
    const allMessages: ChatMessage[] = [
      { role: 'system', content: options.systemPrompt },
      ...options.messages
    ]

    const requestBody: any = {
      model: this.modelName,
      messages: allMessages.map(m => ({
        role: m.role,
        content: m.content,
        tool_calls: m.toolCalls
      })),
      stream: true
    }

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools
    }

    fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                options.onComplete()
                return
              }
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                if (content) {
                  options.onChunk(content)
                }
              } catch {
                // Ignore parse errors for partial data
              }
            }
          }
        }

        options.onComplete()
      })
      .catch((error) => {
        options.onError(error)
      })
  }
}

// MiniMax adapter
class MiniMaxAdapter extends OpenAIAdapter {
  provider: ModelProvider = 'minimax'

  constructor(apiKey: string, endpoint: string, modelName: string) {
    // MiniMax uses OpenAI-compatible API
    super(apiKey, endpoint || 'https://api.minimax.chat/v1', modelName || 'MiniMax-Text-01')
  }
}

// GLM (Zhipu) adapter
class GLMAdapter extends BaseAdapter {
  provider: ModelProvider = 'glm'

  constructor(apiKey: string, endpoint: string, modelName: string) {
    // GLM uses OpenAI-compatible API
    super(apiKey, endpoint || 'https://open.bigmodel.cn/api/paas/v4', modelName || 'glm-4')
  }

  async chat(messages: ChatMessage[], systemPrompt: string, tools?: ToolDefinition[]): Promise<ChatResponse> {
    const allMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ]

    const requestBody: any = {
      model: this.modelName,
      messages: allMessages,
      stream: false
    }

    if (tools && tools.length > 0) {
      requestBody.tools = tools
    }

    const response = await this.fetchWithTimeout(
      `${this.endpoint}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GLM API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    const choice = data.choices[0]

    return {
      content: choice.message?.content || '',
      toolCalls: choice.message?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function?.name,
        arguments: JSON.parse(tc.function?.arguments || '{}')
      })),
      finishReason: choice.finish_reason
    }
  }

  stream(options: StreamOptions): void {
    const allMessages: any[] = [
      { role: 'system', content: options.systemPrompt },
      ...options.messages
    ]

    const requestBody: any = {
      model: this.modelName,
      messages: allMessages,
      stream: true
    }

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools
    }

    fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                options.onComplete()
                return
              }
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                if (content) {
                  options.onChunk(content)
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        options.onComplete()
      })
      .catch((error) => {
        options.onError(error)
      })
  }
}

// Xiaomi adapter
class XiaomiAdapter extends OpenAIAdapter {
  provider: ModelProvider = 'xiaomi'

  constructor(apiKey: string, endpoint: string, modelName: string) {
    super(apiKey, endpoint || 'https://api.xiaomi.com/v1', modelName || 'MiMo-8B')
  }
}

// Qwen adapter
class QwenAdapter extends BaseAdapter {
  provider: ModelProvider = 'qwen'

  constructor(apiKey: string, endpoint: string, modelName: string) {
    super(apiKey, endpoint || 'https://dashscope.aliyuncs.com/api/v1', modelName || 'qwen-turbo')
  }

  async chat(messages: ChatMessage[], systemPrompt: string, tools?: ToolDefinition[]): Promise<ChatResponse> {
    const allMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ]

    const requestBody: any = {
      model: this.modelName,
      messages: allMessages,
      stream: false
    }

    if (tools && tools.length > 0) {
      requestBody.tools = tools
    }

    const response = await this.fetchWithTimeout(
      `${this.endpoint}/services/aigc/text-generation/text-generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Qwen API error: ${response.status} ${error}`)
    }

    const data = await response.json()
    const output = data.output?.text || data.choices?.[0]?.message?.content || ''

    return {
      content: output,
      toolCalls: data.choices?.[0]?.message?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function?.name,
        arguments: typeof tc.function?.arguments === 'string'
          ? JSON.parse(tc.function?.arguments)
          : tc.function?.arguments || {}
      })),
      finishReason: 'stop'
    }
  }

  stream(options: StreamOptions): void {
    // SSE streaming for Qwen
    const allMessages: any[] = [
      { role: 'system', content: options.systemPrompt },
      ...options.messages
    ]

    const requestBody: any = {
      model: this.modelName,
      messages: allMessages,
      stream: true
    }

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools
    }

    fetch(`${this.endpoint}/services/aigc/text-generation/text-generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim()
              if (data === '[DONE]') {
                options.onComplete()
                return
              }
              try {
                const parsed = JSON.parse(data)
                const content = parsed.output?.text || parsed.choices?.[0]?.delta?.content
                if (content) {
                  options.onChunk(content)
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        options.onComplete()
      })
      .catch((error) => {
        options.onError(error)
      })
  }
}

// Factory function to create adapters
export function createModelAdapter(
  provider: ModelProvider,
  apiKey: string,
  endpoint: string,
  modelName: string
): ModelAdapter {
  switch (provider) {
    case 'openai':
      return new OpenAIAdapter(apiKey, endpoint, modelName)
    case 'minimax':
      return new MiniMaxAdapter(apiKey, endpoint, modelName)
    case 'glm':
      return new GLMAdapter(apiKey, endpoint, modelName)
    case 'xiaomi':
      return new XiaomiAdapter(apiKey, endpoint, modelName)
    case 'qwen':
      return new QwenAdapter(apiKey, endpoint, modelName)
    default:
      return new OpenAIAdapter(apiKey, endpoint, modelName)
  }
}

// Tool definitions for the MVP
export const MVP_TOOLS: ToolDefinition[] = [
  {
    name: 'file_read',
    description: 'Read the contents of a file from the file system',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file to read (relative to working directory or absolute)'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'file_write',
    description: 'Write or overwrite a file with new content',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path where the file should be written'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file'
        }
      },
      required: ['file_path', 'content']
    }
  },
  {
    name: 'file_append',
    description: 'Append content to the end of an existing file',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The path to the file to append to'
        },
        content: {
          type: 'string',
          description: 'The content to append'
        }
      },
      required: ['file_path', 'content']
    }
  },
  {
    name: 'dir_list',
    description: 'List the contents of a directory',
    parameters: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'The path to the directory (defaults to working directory)'
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to list subdirectories recursively'
        }
      }
    }
  },
  {
    name: 'bash_execute',
    description: 'Execute a bash/shell command in a sandboxed environment',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'grep_search',
    description: 'Search for a pattern in files',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The search pattern (regex supported)'
        },
        file_path: {
          type: 'string',
          description: 'Directory or file path to search in'
        },
        case_sensitive: {
          type: 'boolean',
          description: 'Whether the search should be case sensitive'
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'glob',
    description: 'Find files matching a glob pattern',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match (e.g., "**/*.ts")'
        }
      },
      required: ['pattern']
    }
  },
  {
    name: 'tool_status',
    description: 'Check the status of the tool execution environment',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
]

// v2: Extended tool definitions
export const V2_TOOLS: ToolDefinition[] = [
  ...MVP_TOOLS,
  {
    name: 'edit_code',
    description: 'Apply code modifications using unified diff format. Creates a backup before editing.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file to edit'
        },
        diff: {
          type: 'string',
          description: 'Unified diff string with the changes to apply'
        },
        create_backup: {
          type: 'boolean',
          description: 'Whether to create a backup before editing (default: true)'
        }
      },
      required: ['file_path', 'diff']
    }
  },
  {
    name: 'project_tree',
    description: 'Generate a tree view of the project structure, including files and directories',
    parameters: {
      type: 'object',
      properties: {
        root_path: {
          type: 'string',
          description: 'Root directory to start the tree from (defaults to working directory)'
        },
        max_depth: {
          type: 'number',
          description: 'Maximum depth to traverse (default: 5, use -1 for unlimited)'
        },
        include_hidden: {
          type: 'boolean',
          description: 'Whether to include hidden files/directories (default: false)'
        },
        exclude_patterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of glob patterns to exclude (e.g., ["node_modules", "*.log"])'
        }
      }
    }
  },
  {
    name: 'web_search',
    description: 'Search the web for information using Brave Search API',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query string'
        },
        count: {
          type: 'number',
          description: 'Number of results to return (1-10, default: 5)'
        },
        freshness: {
          type: 'string',
          description: 'Filter by freshness: pd (24h), pw (week), pm (month), py (year)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'task_plan',
    description: 'Decompose a complex task into smaller subtasks with clear dependencies',
    parameters: {
      type: 'object',
      properties: {
        task_description: {
          type: 'string',
          description: 'The complex task to decompose'
        },
        max_subtasks: {
          type: 'number',
          description: 'Maximum number of subtasks to generate (default: 5)'
        },
        include_dependencies: {
          type: 'boolean',
          description: 'Whether to include dependency information between subtasks (default: true)'
        }
      },
      required: ['task_description']
    }
  }
]
