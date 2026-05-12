/**
 * 向量存储（SQLite）
 */

import { ChunkWithEmbedding } from './types';

export interface VectorStore {
  add(chunks: ChunkWithEmbedding[]): Promise<void>;
  search(queryEmbedding: number[], topK: number): Promise<ChunkWithEmbedding[]>;
  delete(documentId: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * SQLite 向量存储实现
 * 使用 sqlite3 和 better-sqlite3
 */
export class SQLiteVectorStore implements VectorStore {
  private db: any = null;
  private dimension: number;

  constructor(dbPath: string = ':memory:', dimension: number = 384) {
    this.dimension = dimension;
    this.initDatabase(dbPath);
  }

  private async initDatabase(dbPath: string): Promise<void> {
    try {
      const sqlite3 = require('sqlite3').verbose();
      this.db = new sqlite3.Database(dbPath);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS chunks (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          content TEXT NOT NULL,
          index INTEGER NOT NULL,
          metadata TEXT,
          embedding BLOB NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_document_id ON chunks(document_id);
      `);
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  async add(chunks: ChunkWithEmbedding[]): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (id, document_id, content, index, metadata, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((chunks: ChunkWithEmbedding[]) => {
      for (const chunk of chunks) {
        stmt.run(
          chunk.id,
          chunk.documentId,
          chunk.content,
          chunk.index,
          JSON.stringify(chunk.metadata),
          Buffer.from(new Float32Array(chunk.embedding).buffer)
        );
      }
    });

    insertMany(chunks);
  }

  async search(queryEmbedding: number[], topK: number): Promise<ChunkWithEmbedding[]> {
    const rows = this.db.all('SELECT * FROM chunks');
    const results: Array<{ chunk: ChunkWithEmbedding; score: number }> = [];

    for (const row of rows) {
      const embedding = new Float32Array(Buffer.from(row.embedding));
      const score = this.cosineSimilarity(queryEmbedding, Array.from(embedding));
      results.push({
        chunk: {
          id: row.id,
          documentId: row.document_id,
          content: row.content,
          index: row.index,
          metadata: JSON.parse(row.metadata || '{}'),
          embedding: Array.from(embedding),
        },
        score,
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(r => r.chunk);
  }

  async delete(documentId: string): Promise<void> {
    this.db.exec(`DELETE FROM chunks WHERE document_id = '${documentId}'`);
  }

  async clear(): Promise<void> {
    this.db.exec('DELETE FROM chunks');
  }

  private cosineSimilarity(a: number[], b: number[]): number {
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

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

export const vectorStore = new SQLiteVectorStore();
