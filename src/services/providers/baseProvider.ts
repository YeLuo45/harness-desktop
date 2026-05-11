/**
 * Base Provider Implementation
 */

import { LLMMessage, LLMResponse, Provider, ProviderConfig } from './types';

export abstract class BaseProvider implements Provider {
  abstract name: string;
  config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = {
      name: config.name,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
      timeout: config.timeout ?? 30000,
      ...config,
    };
  }

  abstract chat(messages: LLMMessage[]): Promise<LLMResponse>;
  abstract complete(prompt: string): Promise<LLMResponse>;

  isConfigured(): boolean {
    return !!this.config.apiKey || !!this.config.baseUrl;
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = this.config.timeout || 30000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected formatMessages(messages: LLMMessage[]): string {
    return messages.map(m => `${m.role}: ${m.content}`).join('\n');
  }

  protected handleError(error: unknown): LLMResponse {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: '',
      error: message,
      finishReason: 'error',
    };
  }
}
