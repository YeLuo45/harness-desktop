/**
 * MiniMax Compatible Provider Implementation
 */

import { BaseProvider } from './baseProvider';
import { LLMMessage, LLMResponse, ProviderConfig } from './types';

export class MiniMaxProvider extends BaseProvider {
  name = 'minimax';
  private baseURL: string;
  private apiKey: string;
  private model: string;

  constructor(config: ProviderConfig) {
    super(config);
    // MiniMax uses Anthropic-compatible endpoint
    this.baseURL = config.baseUrl || 'https://api.minimax.io/anthropic';
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'MiniMax-Text-01';
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      return this.handleError(new Error('MiniMax provider not configured: missing API key or base URL'));
    }

    try {
      // Convert messages to Anthropic-compatible format
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const response = await this.fetchWithTimeout(
        `${this.baseURL}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: this.config.maxTokens || 8192,
            temperature: this.config.temperature ?? 1.0,
            system: systemMessage?.content || undefined,
            messages: conversationMessages.map(m => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content,
            })),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        return this.handleError(new Error(`MiniMax API error: ${response.status} ${errorData}`));
      }

      const data = await response.json();
      
      return {
        content: data.content?.[0]?.text || '',
        model: data.model || this.model,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens || 0,
          completionTokens: data.usage.output_tokens || 0,
          totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        } : undefined,
        finishReason: data.stop_reason || 'stop',
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
