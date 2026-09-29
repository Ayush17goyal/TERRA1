import { type EmbeddingProvider, OpenAIEmbeddingProvider } from '../lib/embeddings';

export class EmbeddingService {
  private provider: EmbeddingProvider;

  /**
   * Instantiate EmbeddingService with an optional custom provider.
   * Defaults to OpenAIEmbeddingProvider.
   */
  constructor(provider?: EmbeddingProvider) {
    this.provider = provider || new OpenAIEmbeddingProvider();
  }

  /**
   * Replaces the active embedding provider dynamically at runtime
   */
  setProvider(provider: EmbeddingProvider): void {
    console.log(`[EmbeddingService] Swapping embedding provider...`);
    this.provider = provider;
  }

  /**
   * Returns the vector dimension size of the active provider
   */
  getVectorSize(): number {
    return this.provider.getVectorSize();
  }

  /**
   * Generate a vector embedding for a single text block
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      console.warn(`[EmbeddingService] Empty text passed. Returning zeroed vector.`);
      return new Array(this.getVectorSize()).fill(0);
    }
    return this.provider.generateEmbedding(text);
  }

  /**
   * Generate vector embeddings for a batch of text blocks
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    // Filter out empty texts while preserving indices, or map them to zeroed vectors
    const promises = texts.map(async (text) => {
      if (!text || text.trim() === '') {
        return new Array(this.getVectorSize()).fill(0);
      }
      return this.generateEmbedding(text);
    });

    if (this.provider.generateBatchEmbeddings) {
      try {
        return await this.provider.generateBatchEmbeddings(texts);
      } catch (error: any) {
        console.error(`[EmbeddingService] Batch operation failed on provider level: ${error.message}. Falling back to sequential execution.`);
      }
    }

    return Promise.all(promises);
  }
}
