import { Injectable, Logger } from '@nestjs/common';
import { QdrantService } from './qdrant.service';
import { BgeM3Provider } from './bge-m3.provider';

export type RetrievalCollection =
  | 'judgments'
  | 'acts'
  | 'research_papers'
  | 'law_commission_reports'
  | 'user_documents';

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    private readonly qdrantService: QdrantService,
    private readonly bgeM3Provider: BgeM3Provider,
  ) {}

  /**
   * Upsert a document chunk with metadata into Qdrant
   */
  async upsertDocument(
    collection: RetrievalCollection,
    id: string,
    text: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    try {
      this.logger.log(`Generating embedding for document ID ${id} in collection ${collection}`);
      const vector = await this.generateQdrantVector(text);
      
      const client = this.qdrantService.getClient();
      
      await client.upsert(collection, {
        wait: true,
        points: [
          {
            id,
            vector,
            payload: {
              text,
              ...metadata,
            },
          },
        ],
      });
      this.logger.log(`Document ID ${id} successfully upserted into collection ${collection}`);
    } catch (error) {
      this.logger.error(
        `Failed to upsert document ID ${id} in collection ${collection}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Search for similar documents in Qdrant
   */
  async search(
    collection: RetrievalCollection,
    query: string,
    limit: number = 5,
    filter?: any,
  ): Promise<any[]> {
    try {
      this.logger.log(`Searching collection ${collection} for query: "${query}"`);
      const vector = await this.generateQdrantVector(query);
      
      const client = this.qdrantService.getClient();
      
      const results = await client.search(collection, {
        vector,
        limit,
        filter,
        with_payload: true,
      });

      return results.map((hit) => ({
        id: hit.id,
        score: hit.score,
        text: hit.payload?.text,
        metadata: { ...hit.payload },
      }));
    } catch (error) {
      this.logger.error(
        `Search failed in collection ${collection} for query "${query}": ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateQdrantVector(text: string): Promise<number[]> {
    try {
      return await this.bgeM3Provider.generateEmbedding(text);
    } catch (error) {
      this.logger.warn('BGE-M3 vector generation failed. Using deterministic 1024-dim fallback.');
      return this.generateLocalEmbedding(text, this.bgeM3Provider.getVectorSize());
    }
  }

  private generateLocalEmbedding(text: string, size: number): number[] {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    const random = () => {
      hash = (hash * 1664525 + 1013904223) % 4294967296;
      return hash / 4294967296;
    };
    const vector = new Array(size);
    let sumSquares = 0;
    for (let i = 0; i < size; i++) {
      const value = random() * 2 - 1;
      vector[i] = value;
      sumSquares += value * value;
    }
    const magnitude = Math.sqrt(sumSquares) || 1;
    return vector.map((value) => value / magnitude);
  }

  /**
   * Delete a single document point by ID from Qdrant
   */
  async deleteDocument(collection: RetrievalCollection, id: string): Promise<void> {
    try {
      this.logger.log(`Deleting point ID ${id} from collection ${collection}`);
      const client = this.qdrantService.getClient();
      
      await client.delete(collection, {
        points: [id],
      });
      this.logger.log(`Point ID ${id} successfully deleted from collection ${collection}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete point ID ${id} from collection ${collection}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Clear all points in a collection (by deleting and re-creating it)
   */
  async clearCollection(collection: RetrievalCollection): Promise<void> {
    try {
      this.logger.log(`Clearing all data from collection ${collection}`);
      const client = this.qdrantService.getClient();
      const vectorSize = this.bgeM3Provider.getVectorSize();

      await client.deleteCollection(collection);
      await client.createCollection(collection, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      });
      this.logger.log(`Collection ${collection} successfully cleared.`);
    } catch (error) {
      this.logger.error(
        `Failed to clear collection ${collection}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
