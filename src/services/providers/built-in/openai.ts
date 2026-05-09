import type { ChatMessage, ChatResponse, StreamOptions } from '../../../types'
import { BaseAdapter } from './baseAdapter'
import type { ProviderConfig } from '../types'

/**
 * OpenAI Provider - supports GPT-4, GPT-4o, GPT-3.5-turbo, etc.
 */
export class OpenAIProvider extends BaseAdapter {
  readonly id = 'openai'
  readonly name = 'OpenAI'
  readonly defaultEndpoint = 'https://api.openai.com/v1'
  readonly defaultModel = 'gpt-4o'

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
      messages: allMessages.map(m => ({
        role: m.role,
        content: m.content,
        tool_calls: m.toolCalls,
        tool_call_id: (m as any).toolCallId
      })),
      stream: false
    }

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools
      requestBody.tool_choice = 'auto'
    }

    const response = await this.fetchWithTimeout(
      `${this.endpoint}/chat/completions`,
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
    const allMessages = this.buildMessages(options.messages, options.systemPrompt)

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
        'Authorization': `Bearer ${this.config.apiKey}`
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

/**
 * Factory function for OpenAI provider
 */
export function createOpenAIProvider(config: ProviderConfig): OpenAIProvider {
  return new OpenAIProvider(config)
}
