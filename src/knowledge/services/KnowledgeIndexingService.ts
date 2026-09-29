import { KnowledgeChunker } from '../chunking/KnowledgeChunker';
import type { EmbeddingService, KnowledgeDocument, KnowledgeRepository } from '../types';

export class KnowledgeIndexingService {
  private readonly repository: KnowledgeRepository;
  private readonly embeddingService: EmbeddingService;
  private readonly chunker: KnowledgeChunker;

  constructor(repository: KnowledgeRepository, embeddingService: EmbeddingService, chunker = new KnowledgeChunker()) {
    this.repository = repository;
    this.embeddingService = embeddingService;
    this.chunker = chunker;
  }

  async indexDocuments(documents: KnowledgeDocument[]): Promise<{ documents: number; chunks: number }> {
    const indexable = documents.filter((document) =>
      ['pattern', 'bare_act_component', 'curriculum', 'lesson', 'teaching_rule', 'behaviour_rule'].includes(document.kind)
    );
    const chunks = this.chunker.chunkMany(indexable);
    const embeddings = await this.embeddingService.generateBatchEmbeddings(chunks.map((chunk) => chunk.content));
    const embeddedChunks = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    }));

    await this.repository.upsertChunks(embeddedChunks);

    return {
      documents: indexable.length,
      chunks: embeddedChunks.length,
    };
  }
}
