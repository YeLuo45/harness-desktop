/**
 * 语义检索器
 * 使用余弦相似度进行语义检索
 */

import { SearchResult, ChunkWithEmbedding } from './types';
import { VectorStore, vectorStore } from './vectorStore';

export class Retriever {
  private vectorStore: VectorStore;
  private topK: number;
  private similarityThreshold: number;

  constructor(
    vectorStore: VectorStore,
    topK: number = 5,
    similarityThreshold: number = 0.5
  ) {
    this.vectorStore = vectorStore;
    this.topK = topK;
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * 语义检索
   */
  async retrieve(queryEmbedding: number[]): Promise<SearchResult[]> {
    const chunks = await this.vectorStore.search(queryEmbedding, this.topK);

    return chunks.map(chunk => ({
      chunk,
      score: this.computeCosineSimilarity(queryEmbedding, chunk.embedding),
    }));
  }

  /**
   * 过滤低相似度结果
   */
  async retrieveFiltered(queryEmbedding: number[]): Promise<SearchResult[]> {
    const results = await this.retrieve(queryEmbedding);
    return results.filter(r => r.score >= this.similarityThreshold);
  }

  /**
   * 计算余弦相似度
   */
  private computeCosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

export const retriever = new Retriever(vectorStore);
