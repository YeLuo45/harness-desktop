/**
 * OpenAI Compatible Provider Implementation
 */

import { BaseProvider } from './baseProvider';
import { LLMMessage, LLMResponse, ProviderConfig } from './types';

export class OpenAIProvider extends BaseProvider {
  name = 'openai';
  private baseURL: string;
  private apiKey: string;
  private model: string;

  constructor(config: ProviderConfig) {
    super(config);
    this.baseURL = config.baseUrl || 'https://api.openai.com/v1';
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4';
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      return this.handleError(new Error('OpenAI provider not configured: missing API key or base URL'));
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.baseURL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: messages.map(m => ({
              role: m.role,
              content: m.content,
            })),
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        return this.handleError(new Error(`OpenAI API error: ${response.status} ${errorData}`));
      }

      const data = await response.json();
      
      return {
        content: data.choices?.[0]?.message?.content || '',
        model: data.model || this.model,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        } : undefined,
        finishReason: data.choices?.[0]?.finish_reason || 'stop',
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async complete(prompt: string): Promise<LLMResponse> {
    return this.chat([
      { role: 'user', content: prompt }
    ]);
  }
}
