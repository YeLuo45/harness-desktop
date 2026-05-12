/**
 * 知识库类型定义
 */

export interface Document {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  metadata: Record<string, unknown>;
}

export interface ChunkWithEmbedding extends Chunk {
  embedding: number[];
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

export type ChunkStrategy = 'fixed' | 'sentence' | 'paragraph';

export interface ChunkOptions {
  strategy: ChunkStrategy;
  chunkSize?: number;
  overlap?: number;
}

export interface EmbeddingOptions {
  model?: string;
  dimension?: number;
}
