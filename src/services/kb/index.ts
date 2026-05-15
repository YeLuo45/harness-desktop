/**
 * 知识库模块 - 统一导出
 */

// 类型导出
export type {
  Document,
  Chunk,
  ChunkWithEmbedding,
  SearchResult,
  ChunkStrategy,
  ChunkOptions,
  EmbeddingOptions,
} from './types';

// 文档管理
export { DocumentManager, documentManager } from './documentManager';

// 分块器
export { Chunker, chunker } from './chunker';

// Embedder
export type { Embedder } from './embedder';
export { LocalEmbedder, defaultEmbedder } from './embedder';

// 向量存储
export type { VectorStore } from './vectorStore';
export { SQLiteVectorStore, vectorStore } from './vectorStore';

// 知识库管理器
export type { KBManagerOptions } from './kbManager';
export { KBManager, kbManager } from './kbManager';
