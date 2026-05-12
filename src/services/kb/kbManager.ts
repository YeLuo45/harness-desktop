/**
 * 知识库管理器
 * 整合文档管理、分块、Embedding、向量存储和检索功能
 */

import { Document, ChunkWithEmbedding, SearchResult, ChunkOptions, Embedder } from './types';
import { DocumentManager, documentManager } from './documentManager';
import { Chunker, chunker } from './chunker';
import { Embedder as EmbedderType, LocalEmbedder, defaultEmbedder } from './embedder';
import { VectorStore, SQLiteVectorStore, vectorStore } from './vectorStore';
import { Retriever, retriever } from './retriever';

export interface KBManagerOptions {
  embedder?: EmbedderType;
  vectorStore?: VectorStore;
  chunkOptions?: ChunkOptions;
  topK?: number;
  similarityThreshold?: number;
}

export class KBManager {
  private documentManager: DocumentManager;
  private chunker: Chunker;
  private embedder: EmbedderType;
  private vectorStore: VectorStore;
  private retriever: Retriever;
  private chunkOptions: ChunkOptions;

  constructor(options: KBManagerOptions = {}) {
    this.documentManager = documentManager;
    this.chunker = chunker;
    this.embedder = options.embedder || defaultEmbedder;
    this.vectorStore = options.vectorStore || vectorStore;
    this.retriever = new Retriever(this.vectorStore, options.topK || 5, options.similarityThreshold || 0.5);
    this.chunkOptions = options.chunkOptions || { strategy: 'fixed', chunkSize: 500, overlap: 50 };
  }

  /**
   * 添加文档到知识库
   */
  async addDocument(
    title: string,
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<{ document: Document; chunks: ChunkWithEmbedding[] }> {
    // 1. 导入文档
    const document = await this.documentManager.importDocument(title, content, metadata);

    // 2. 分块
    const chunks = this.chunker.chunk(document.id, content, this.chunkOptions);

    // 3. 生成 Embedding
    const texts = chunks.map(c => c.content);
    const embeddings = await this.embedder.embed(texts);

    // 4. 组装 ChunkWithEmbedding
    const chunksWithEmbedding: ChunkWithEmbedding[] = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    }));

    // 5. 存储到向量数据库
    await this.vectorStore.add(chunksWithEmbedding);

    return { document, chunks: chunksWithEmbedding };
  }

  /**
   * 语义检索
   */
  async search(query: string, topK?: number): Promise<SearchResult[]> {
    // 1. 生成查询的 embedding
    const [queryEmbedding] = await this.embedder.embed([query]);

    // 2. 检索
    if (topK) {
      const retriever = new Retriever(this.vectorStore, topK);
      return retriever.retrieve(queryEmbedding);
    }

    return this.retriever.retrieve(queryEmbedding);
  }

  /**
   * 获取文档
   */
  async getDocument(id: string): Promise<Document | null> {
    return this.documentManager.getDocument(id);
  }

  /**
   * 列出所有文档
   */
  async listDocuments(): Promise<Document[]> {
    return this.documentManager.listDocuments();
  }

  /**
   * 删除文档
   */
  async deleteDocument(id: string): Promise<boolean> {
    await this.vectorStore.delete(id);
    return this.documentManager.deleteDocument(id);
  }

  /**
   * 清空知识库
   */
  async clear(): Promise<void> {
    await this.vectorStore.clear();
  }
}

export const kbManager = new KBManager();
