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
  stream(options: any): void;
  isConfigured(): boolean;
}

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'azure' | 'custom';

export interface ProviderInfo {
  type: ProviderType;
  name: string;
  description: string;
  models: string[];
}

// LLMProvider interface for provider abstraction layer
export interface LLMProvider {
  id: string;
  name: string;
  defaultEndpoint: string;
  defaultModel: string;
  chat(options: { messages: any[]; systemPrompt?: string; tools?: any[] }): Promise<any>;
  stream(options: any): void;
  getCapabilities(): ProviderCapabilities;
  validateConfig(config: ProviderConfig): ValidationResult;
}

// Provider factory type
export type ProviderFactory = (config: ProviderConfig) => LLMProvider;

// Validation result type
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

// Provider capabilities
export interface ProviderCapabilities {
  maxTokens: number;
  streaming: boolean;
  tools: boolean;
  vision: boolean;
}
