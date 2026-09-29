import type { DocumentChunk, EmbeddingGenerator } from '../types';

export class DocumentEmbeddingService {
  private readonly generator: EmbeddingGenerator;

  constructor(generator: EmbeddingGenerator) {
    this.generator = generator;
  }

  async embed(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    const embeddings = await this.generator.generateBatchEmbeddings(chunks.map((chunk) => chunk.content));
    return chunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] }));
  }
}
