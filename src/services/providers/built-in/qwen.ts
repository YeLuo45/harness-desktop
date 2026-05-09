import type { ChatMessage, ChatResponse, StreamOptions } from '../../../types'
import { BaseAdapter } from './baseAdapter'
import type { ProviderConfig } from '../types'

/**
 * Qwen Provider (Alibaba Cloud) - DashScope API
 */
export class QwenProvider extends BaseAdapter {
  readonly id = 'qwen'
  readonly name = 'Qwen (Alibaba)'
  readonly defaultEndpoint = 'https://dashscope.aliyuncs.com/api/v1'
  readonly defaultModel = 'qwen-turbo'

  protected getDefaultConfig(): Partial<ProviderConfig> {
    return {
      endpoint: this.defaultEndpoint,
      modelName: this.defaultModel
    }
  }

  async chat(options: { messages: ChatMessage[]; systemPrompt?: string; tools?: any[] }): Promise<ChatResponse> {
    const allMessages = this.buildMessages(options.messages, options.systemPrompt)

    const requestBody: any = {
      model: this.modelName,
      messages: allMessages,
      stream: false
    }

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools
    }

    // Qwen uses a different endpoint path
    const response = await this.fetchWithTimeout(
      `${this.endpoint}/services/aigc/text-generation/text-generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
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
          ? JSON.parse(tc.function.arguments)
          : tc.function?.arguments || {}
      })),
      finishReason: 'stop'
    }
  }

  stream(options: StreamOptions): void {
    const allMessages = this.buildMessages(options.messages, options.systemPrompt)

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
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`API error: ${response.status}`)

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

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
                if (content) options.onChunk(content)
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
        options.onComplete()
      })
      .catch((error) => options.onError(error))
  }
}

export function createQwenProvider(config: ProviderConfig): QwenProvider {
  return new QwenProvider(config)
}
