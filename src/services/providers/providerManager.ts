/**
 * Provider Manager - Handles provider registration and switching
 */

import { BaseProvider } from './baseProvider';
import { Provider, ProviderConfig, ProviderType, ProviderInfo, LLMMessage, LLMResponse } from './types';

export class ProviderManager {
  private providers: Map<string, BaseProvider> = new Map();
  private currentProvider: BaseProvider | null = null;

  register(provider: BaseProvider): void {
    this.providers.set(provider.name, provider);
    if (!this.currentProvider) {
      this.currentProvider = provider;
    }
  }

  unregister(name: string): boolean {
    if (this.currentProvider?.name === name) {
      this.currentProvider = null;
    }
    return this.providers.delete(name);
  }

  getProvider(name: string): BaseProvider | undefined {
    return this.providers.get(name);
  }

  setCurrentProvider(name: string): boolean {
    const provider = this.providers.get(name);
    if (provider) {
      this.currentProvider = provider;
      return true;
    }
    return false;
  }

  updateProviderConfig(name: string, apiKey: string, endpoint?: string, model?: string): boolean {
    const provider = this.providers.get(name);
    if (provider) {
      provider.config.apiKey = apiKey;
      if (endpoint) provider.config.baseUrl = endpoint;
      if (model) provider.config.model = model;
      return true;
    }
    return false;
  }

  getCurrentProvider(): BaseProvider | null {
    return this.currentProvider;
  }

  listProviders(): ProviderInfo[] {
    return Array.from(this.providers.values()).map(p => ({
      type: this.inferProviderType(p.name),
      name: p.name,
      description: `${p.name} provider`,
      models: [p.config.model || 'default'].filter(Boolean),
    }));
  }

  private inferProviderType(name: string): ProviderType {
    const lower = name.toLowerCase();
    if (lower.includes('openai')) return 'openai';
    if (lower.includes('anthropic')) return 'anthropic';
    if (lower.includes('google') || lower.includes('gemini')) return 'google';
    if (lower.includes('azure')) return 'azure';
    return 'custom';
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    if (!this.currentProvider) {
      return {
        content: '',
        error: 'No provider configured',
        finishReason: 'error',
      };
    }
    return this.currentProvider.chat(messages);
  }

  async complete(prompt: string): Promise<LLMResponse> {
    if (!this.currentProvider) {
      return {
        content: '',
        error: 'No provider configured',
        finishReason: 'error',
      };
    }
    return this.currentProvider.complete(prompt);
  }
}

export const providerManager = new ProviderManager();
