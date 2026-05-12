/**
 * 文本分块器
 * 支持固定大小、句子、段落三种分块策略
 */

import { Chunk, ChunkOptions, ChunkStrategy } from './types';

export class Chunker {
  /**
   * 分块
   */
  chunk(documentId: string, text: string, options: ChunkOptions): Chunk[] {
    const { strategy, chunkSize = 500, overlap = 50 } = options;

    switch (strategy) {
      case 'fixed':
        return this.chunkByFixedSize(documentId, text, chunkSize, overlap);
      case 'sentence':
        return this.chunkBySentence(documentId, text, chunkSize, overlap);
      case 'paragraph':
        return this.chunkByParagraph(documentId, text);
      default:
        return this.chunkByFixedSize(documentId, text, chunkSize, overlap);
    }
  }

  /**
   * 固定大小分块
   */
  private chunkByFixedSize(
    documentId: string,
    text: string,
    chunkSize: number,
    overlap: number
  ): Chunk[] {
    const chunks: Chunk[] = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
      let end = start + chunkSize;
      if (end >= text.length) {
        end = text.length;
      } else {
        // 尝试在句子边界或空格处分割
        const boundary = this.findBoundary(text, start, end);
        if (boundary > start) {
          end = boundary;
        }
      }

      const content = text.slice(start, end).trim();
      if (content) {
        chunks.push({
          id: `chunk_${documentId}_${index}`,
          documentId,
          content,
          index,
          metadata: { strategy: 'fixed', start, end },
        });
      }

      start = end - overlap;
      if (start < 0) start = 0;
      index++;
    }

    return chunks;
  }

  /**
   * 句子分块
   */
  private chunkBySentence(
    documentId: string,
    text: string,
    chunkSize: number,
    overlap: number
  ): Chunk[] {
    const sentences = this.splitSentences(text);
    const chunks: Chunk[] = [];
    let currentChunk = '';
    let index = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk) {
        chunks.push({
          id: `chunk_${documentId}_${index}`,
          documentId,
          content: currentChunk.trim(),
          index,
          metadata: { strategy: 'sentence' },
        });
        index++;
        // 应用重叠
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlap / 5)).join(' ');
        currentChunk = overlapWords + ' ' + sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: `chunk_${documentId}_${index}`,
        documentId,
        content: currentChunk.trim(),
        index,
        metadata: { strategy: 'sentence' },
      });
    }

    return chunks;
  }

  /**
   * 段落分块
   */
  private chunkByParagraph(documentId: string, text: string): Chunk[] {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    return paragraphs.map((content, index) => ({
      id: `chunk_${documentId}_${index}`,
      documentId,
      content: content.trim(),
      index,
      metadata: { strategy: 'paragraph' },
    }));
  }

  /**
   * 查找合适的分割边界
   */
  private findBoundary(text: string, start: number, end: number): number {
    // 尝试在句号、问号、感叹号后分割
    for (let i = end; i > start + 10; i--) {
      if (['。', '！', '？', '.', '!', '?'].includes(text[i])) {
        return i + 1;
      }
    }
    // 尝试在空格处分割
    for (let i = end; i > start + 10; i--) {
      if (text[i] === ' ' || text[i] === '\n') {
        return i;
      }
    }
    return end;
  }

  /**
   * 分割句子
   */
  private splitSentences(text: string): string[] {
    // 中英文句子分割
    const pattern = /[。！？.!?]+/g;
    const sentences = text.split(pattern).filter(s => s.trim());
    return sentences;
  }
}

export const chunker = new Chunker();
