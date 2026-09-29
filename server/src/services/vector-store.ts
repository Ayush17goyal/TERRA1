import { Injectable, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { EmbeddingService } from '../modules/retrieval/embedding.service';

export interface VectorStorePayload {
  [key: string]: any;
  document_id: string;
  chunk_id: string;
  document_type: string;
  user_id: string;
  source_file: string;
  chunk_index: number;
  confidence: number;
  quality_score: number;
  processed_at: string;
}

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);
  private client: QdrantClient;
  private readonly collectionName = 'user_documents';

  constructor(private embeddingService: EmbeddingService) {
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    this.client = new QdrantClient({ url: qdrantUrl });
  }

  /**
   * Initialize collection for user documents
   */
  async initializeCollection(): Promise<void> {
    try {
      // Check if collection exists
      try {
        await this.client.getCollection(this.collectionName);
        this.logger.log(`Collection ${this.collectionName} already exists`);
        return;
      } catch {
        // Collection doesn't exist, create it
      }

      const vectorSize = this.embeddingService.getVectorSize();
      
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      });
      
      this.logger.log(`Created collection ${this.collectionName} with vector size ${vectorSize}`);
    } catch (error: any) {
      this.logger.error(`Failed to initialize collection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store document chunks with embeddings
   */
  async storeChunks(
    documentId: string,
    chunks: Array<{
      id: string;
      text: string;
      chunkIndex: number;
      confidence: number;
      pageNumber?: number;
    }>,
    metadata: {
      document_type: string;
      user_id: string;
      source_file: string;
      quality_score: number;
    }
  ): Promise<{
    success: boolean;
    chunksStored: number;
    vectorsGenerated: number;
    error?: string;
  }> {
    try {
      // Generate embeddings for all chunks
      const texts = chunks.map(c => c.text);
      const embeddings = await this.embeddingService.generateEmbeddings(texts);

      if (embeddings.length !== chunks.length) {
        throw new Error(`Embedding count mismatch: ${embeddings.length} vs ${chunks.length}`);
      }

      // Prepare points for Qdrant
      const points: any[] = chunks.map((chunk, index) => ({
        id: this.generatePointId(documentId, chunk.chunkIndex),
        vector: embeddings[index] || new Array(this.embeddingService.getVectorSize()).fill(0),
        payload: {
          document_id: documentId,
          chunk_id: chunk.id,
          document_type: metadata.document_type,
          user_id: metadata.user_id,
          source_file: metadata.source_file,
          chunk_index: chunk.chunkIndex,
          confidence: chunk.confidence,
          quality_score: metadata.quality_score,
          processed_at: new Date().toISOString(),
          page_number: chunk.pageNumber || 1,
        } as VectorStorePayload,
      }));

      // Upsert points to Qdrant
      await this.client.upsert(this.collectionName, {
        points,
      } as any);

      this.logger.log(
        `Stored ${points.length} vectors for document ${documentId} ` +
        `in collection ${this.collectionName}`
      );

      return {
        success: true,
        chunksStored: chunks.length,
        vectorsGenerated: embeddings.length,
      };
    } catch (error: any) {
      this.logger.error(`Failed to store chunks: ${error.message}`);
      return {
        success: false,
        chunksStored: 0,
        vectorsGenerated: 0,
        error: error.message,
      };
    }
  }

  /**
   * Search for similar chunks
   */
  async search(
    query: string,
    userId: string,
    limit = 10,
    scoreThreshold = 0.6
  ): Promise<Array<{
    chunk_id: string;
    document_id: string;
    similarity: number;
    text: string;
    source_file: string;
  }>> {
    try {
      const queryVector = await this.embeddingService.generateEmbedding(query);

      const results = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit,
        filter: {
          must: [
            {
              key: 'payload.user_id',
              match: { value: userId },
            },
          ],
        },
      } as any);

      return results
        .filter(r => (r as any).score >= scoreThreshold)
        .map(r => ({
          chunk_id: (r as any).payload?.chunk_id || '',
          document_id: (r as any).payload?.document_id || '',
          similarity: (r as any).score || 0,
          text: (r as any).payload?.chunk_text || '',
          source_file: (r as any).payload?.source_file || '',
        }));
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete document from vector store
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: 'payload.document_id',
              match: { value: documentId },
            },
          ],
        },
      } as any);

      this.logger.log(`Deleted vectors for document ${documentId}`);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Failed to delete document: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(documentId: string): Promise<{
    vectorCount: number;
    avgConfidence: number;
    storageSize: number;
  }> {
    try {
      const results = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            {
              key: 'payload.document_id',
              match: { value: documentId },
            },
          ],
        },
        limit: 10000,
      } as any);

      if (!results.points || results.points.length === 0) {
        return { vectorCount: 0, avgConfidence: 0, storageSize: 0 };
      }

      const confidences = results.points
        .map(p => (p.payload as any)?.confidence || 1)
        .filter(Boolean);
      
      const avgConfidence = confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;

      return {
        vectorCount: results.points.length,
        avgConfidence,
        storageSize: results.points.length * 1536 * 4, // Approx 1536-dim float32
      };
    } catch (error: any) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      return { vectorCount: 0, avgConfidence: 0, storageSize: 0 };
    }
  }

  /**
   * Generate deterministic point ID from document and chunk index
   */
  private generatePointId(documentId: string, chunkIndex: number): number {
    // Simple hash to generate consistent numeric ID
    const combined = `${documentId}_${chunkIndex}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % Number.MAX_SAFE_INTEGER;
  }
}
