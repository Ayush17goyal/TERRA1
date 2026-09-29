import type { DocumentChunk, DocumentIndexer } from '../types';
import type { KnowledgeRepository } from '../../knowledge/types';
import { toKnowledgeDocuments } from '../types';

export class PgVectorDocumentIndexer implements DocumentIndexer {
  private readonly repository: KnowledgeRepository;

  constructor(repository: KnowledgeRepository) {
    this.repository = repository;
  }

  async index(chunks: DocumentChunk[]): Promise<void> {
    const docs = toKnowledgeDocuments(chunks);
    await this.repository.upsertChunks(docs.map((doc, index) => ({
      ...doc,
      parentId: String(doc.metadata.document_id),
      chunkIndex: index,
      tokenEstimate: Number(doc.metadata.token_count ?? Math.ceil(doc.content.length / 4)),
    })));
  }
}
