/**
 * Built-in Skill: Web Search
 */

import { SkillManifest } from '../types';

export const webSearchManifest: SkillManifest = {
  id: 'builtin:webSearch',
  name: 'Web Search',
  version: '1.0.0',
  description: 'Search the web for information',
  author: 'Hermes Team',
  tags: ['web', 'search', 'builtin'],
  entryPoint: './builtin/webSearch',
};

export interface WebSearchOptions {
  query: string;
  limit?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(options: WebSearchOptions): Promise<{ results: SearchResult[] }> {
  // Simulate search results
  return {
    results: [
      {
        title: `Result for: ${options.query}`,
        url: `https://example.com/search?q=${encodeURIComponent(options.query)}`,
        snippet: `Search results for "${options.query}" would appear here.`
      }
    ]
  };
}

// Alias for backwards compatibility
export async function search(query: string): Promise<SearchResult[]> {
  const result = await webSearch({ query });
  return result.results;
}
