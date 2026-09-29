import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * QdrantService
 * ==============
 * Manages the single unified "legal_corpus" Qdrant collection.
 * All Acts, sections, and provisions are stored in this one collection.
 * Filtering by Act, chapter, section is done via payload metadata.
 */
@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;

  /** The one and only collection name for all legal provisions */
  static readonly COLLECTION = 'legal_corpus';

  /** BGE-M3 produces 1024-dimensional dense vectors */
  static readonly VECTOR_SIZE = 1024;

  onModuleInit() {
    const url = process.env.QDRANT_URL || 'http://localhost:6333';
    const rawApiKey = process.env.QDRANT_API_KEY || '';
    const isLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
    const apiKey = rawApiKey && !isLocalHttp ? rawApiKey : undefined;

    this.logger.log(`Initializing Qdrant client → ${url}`);

    this.client = new QdrantClient({ url, apiKey });

    this.initializeLegalCorpusCollection().catch(() => {});
  }

  getClient(): QdrantClient {
    return this.client;
  }

  /**
   * Ensure the unified legal_corpus collection exists with all payload indexes.
   * This is idempotent — safe to call repeatedly.
   */
  async initializeLegalCorpusCollection(): Promise<void> {
    const name = QdrantService.COLLECTION;
    const size = QdrantService.VECTOR_SIZE;

    try {
      this.logger.log('Testing Qdrant connection...');
      await this.client.getCollections();
      this.logger.log('Successfully connected to Qdrant.');
    } catch (error: any) {
      this.logger.warn(
        `Could not connect to Qdrant at ${process.env.QDRANT_URL || 'http://localhost:6333'}. ` +
        `Vector search features will be unavailable. Error: ${error.message}`
      );
      return;
    }

    try {
      const response = await this.client.getCollections();
      const exists = response.collections.some((col) => col.name === name);

      if (!exists) {
        this.logger.log(`Creating unified collection: "${name}" (${size}-dim Cosine)`);
        await this.client.createCollection(name, {
          vectors: { size, distance: 'Cosine' },
        });
        this.logger.log(`Collection "${name}" created.`);
      } else {
        this.logger.log(`Collection "${name}" already exists.`);
      }

      // Register keyword payload indexes for filtering
      const keywordIndexes = [
        'act_id',
        'act_name',
        'category',
        'part',
        'chapter',
        'section',
        'subsection',
        'clause',
        'pdf_source',
        'embedding_version',
        'document_type',
        'jurisdiction',
        'year',
        'source',
      ];

      for (const field of keywordIndexes) {
        try {
          await this.client.createPayloadIndex(name, {
            field_name: field,
            field_schema: 'keyword',
          });
        } catch (_) {
          // Index already exists — safe to ignore
        }
      }

      this.logger.log(`Payload indexes ensured for "${name}".`);
    } catch (error: any) {
      this.logger.error(`Failed to initialize collection "${name}": ${error.message}`, error.stack);
    }
  }
}

