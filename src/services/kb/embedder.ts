/**
 * Embedding 生成器
 */

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
  getDimension(): number;
}

export class LocalEmbedder implements Embedder {
  private dimension: number;

  constructor(dimension: number = 384) {
    this.dimension = dimension;
  }

  /**
   * 生成文本的 embedding
   * 这里使用简单的词频向量作为示例，实际应使用 BERT/OpenAI 等模型
   */
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(text => this.computeSimpleEmbedding(text));
  }

  getDimension(): number {
    return this.dimension;
  }

  /**
   * 简单的词频embedding（仅用于演示）
   * 实际项目中应替换为真实的 embedding 模型
   */
  private computeSimpleEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(this.dimension).fill(0);

    // 简单的哈希方式生成伪embedding
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length && j < this.dimension; j++) {
        embedding[(word.charCodeAt(j) + i) % this.dimension] += 1;
      }
    }

    // L2 归一化
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }
}

export const defaultEmbedder = new LocalEmbedder();
