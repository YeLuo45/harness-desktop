/**
 * 文档管理器
 * 负责文档的导入、获取、列表、删除操作
 */

import { Document } from './types';

export class DocumentManager {
  private documents: Map<string, Document> = new Map();

  /**
   * 导入文档
   */
  async importDocument(
    title: string,
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<Document> {
    const id = this.generateId();
    const now = new Date();
    const document: Document = {
      id,
      title,
      content,
      metadata,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(id, document);
    return document;
  }

  /**
   * 获取文档
   */
  async getDocument(id: string): Promise<Document | null> {
    return this.documents.get(id) || null;
  }

  /**
   * 列出所有文档
   */
  async listDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  /**
   * 删除文档
   */
  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  /**
   * 更新文档
   */
  async updateDocument(
    id: string,
    updates: Partial<Pick<Document, 'title' | 'content' | 'metadata'>>
  ): Promise<Document | null> {
    const doc = this.documents.get(id);
    if (!doc) return null;

    const updated: Document = {
      ...doc,
      ...updates,
      updatedAt: new Date(),
    };
    this.documents.set(id, updated);
    return updated;
  }

  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const documentManager = new DocumentManager();
