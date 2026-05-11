/**
 * LLM Provider Types and Interfaces
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
  error?: string;
}

export interface ProviderConfig {
  name: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  [key: string]: unknown;
}

export interface Provider {
  name: string;
  config: ProviderConfig;
  chat(messages: LLMMessage[]): Promise<LLMResponse>;
  complete(prompt: string): Promise<LLMResponse>;
  isConfigured(): boolean;
}

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'azure' | 'custom';

export interface ProviderInfo {
  type: ProviderType;
  name: string;
  description: string;
  models: string[];
}
