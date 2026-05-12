/**
 * 知识库模块 - 统一导出
 */

// 类型导出
export {
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
export { Embedder, LocalEmbedder, defaultEmbedder } from './embedder';

// 向量存储
export { VectorStore, SQLiteVectorStore, vectorStore } from './vectorStore';

// 检索器
export { Retriever, retriever } from './retriever';

// 知识库管理器
export { KBManager, KBManagerOptions, kbManager } from './kbManager';
