import { Injectable, Logger } from '@nestjs/common';
import { QdrantService } from '../retrieval/qdrant.service';
import { BgeM3Provider } from '../retrieval/bge-m3.provider';
import { SemanticCacheService } from '../chat/semantic-cache.service';
import {
  chunkJudgment,
  chunkBareAct,
  chunkResearchPaper,
  chunkGeneric,
  type DocumentChunk,
  type ChunkerOptions,
} from './legal-chunker';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Ingestion Service
 * ==================
 * Orchestrates the full document → chunk → embed → store pipeline
 * using the BGE-M3 embedding model (1024-dim dense vectors).
 *
 * Supported document types:
 *   - judgment   → JudgmentChunker  → judgments_bge collection
 *   - act        → BareActChunker   → acts_bge collection
 *   - paper      → PaperChunker     → research_papers_bge collection
 */

export type DocumentType =
  | 'constitution'
  | 'bare_acts'
  | 'supreme_court_cases'
  | 'high_court_cases'
  | 'research_papers'
  | 'user_documents'
  | 'bns'
  | 'bnss'
  | 'act'
  | 'judgment'
  | 'paper';

export interface IngestionResult {
  documentId: string;
  documentType: DocumentType;
  fileName: string;
  chunksGenerated: number;
  pointsUpserted: number;
  errors: string[];
  durationMs: number;
}

export interface BatchIngestionResult {
  totalDocuments: number;
  successful: number;
  failed: number;
  results: IngestionResult[];
  totalDurationMs: number;
}

export interface CollectionStats {
  name: string;
  pointCount: number;
  status: string;
}

export interface PipelineStatus {
  bgeM3Healthy: boolean;
  bgeM3Model: string | null;
  qdrantConnected: boolean;
  collections: CollectionStats[];
}

/** Maps document types to their Qdrant collection names */
const COLLECTION_MAP: Record<DocumentType, string> = {
  constitution: 'constitution',
  bare_acts: 'bare_acts',
  supreme_court_cases: 'supreme_court_cases',
  high_court_cases: 'high_court_cases',
  research_papers: 'research_papers',
  user_documents: 'user_documents',
  bns: 'bns_bge',
  bnss: 'bnss_bge',
  act: 'acts_bge',
  judgment: 'judgments_bge',
  paper: 'research_papers_bge',
};

/** BGE-M3 vector dimension */
const BGE_M3_VECTOR_SIZE = 1024;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  /** Batch size for Qdrant upserts */
  private readonly UPSERT_BATCH_SIZE = 50;

  constructor(
    private readonly qdrantService: QdrantService,
    private readonly bgeM3Provider: BgeM3Provider,
    private readonly cacheService: SemanticCacheService,
  ) {}

  // ---------------------------------------------------------------------------
  // Pipeline Status
  // ---------------------------------------------------------------------------

  /**
   * Check the health of the entire ingestion pipeline:
   * BGE-M3 sidecar + Qdrant connection + collection stats.
   */
  async getStatus(): Promise<PipelineStatus> {
    let bgeM3Healthy = false;
    let bgeM3Model: string | null = null;
    let qdrantConnected = false;
    const collections: CollectionStats[] = [];

    // Check BGE-M3 sidecar
    try {
      const health = await this.bgeM3Provider.checkHealth();
      bgeM3Healthy = health.status === 'healthy';
      bgeM3Model = health.model;
    } catch {
      this.logger.warn('BGE-M3 sidecar is not reachable');
    }

    // Check Qdrant and collection stats
    try {
      const client = this.qdrantService.getClient();
      const response = await client.getCollections();
      qdrantConnected = true;

      for (const collectionName of Object.values(COLLECTION_MAP)) {
        const exists = response.collections.some((c) => c.name === collectionName);
        if (exists) {
          try {
            const info = await client.getCollection(collectionName);
            collections.push({
              name: collectionName,
              pointCount: info.points_count || 0,
              status: info.status as string,
            });
          } catch {
            collections.push({
              name: collectionName,
              pointCount: 0,
              status: 'error',
            });
          }
        } else {
          collections.push({
            name: collectionName,
            pointCount: 0,
            status: 'not_created',
          });
        }
      }
    } catch {
      this.logger.warn('Qdrant is not reachable');
    }

    return { bgeM3Healthy, bgeM3Model, qdrantConnected, collections };
  }

  // ---------------------------------------------------------------------------
  // Collection Management
  // ---------------------------------------------------------------------------

  /**
   * Create the three BGE-M3 collections in Qdrant if they don't exist.
   */
  async initializeCollections(): Promise<string[]> {
    const client = this.qdrantService.getClient();
    const created: string[] = [];

    for (const [docType, collectionName] of Object.entries(COLLECTION_MAP)) {
      try {
        const response = await client.getCollections();
        const exists = response.collections.some((c) => c.name === collectionName);

        if (!exists) {
          this.logger.log(
            `Creating BGE-M3 collection: ${collectionName} (${BGE_M3_VECTOR_SIZE}-dim, Cosine)`,
          );
          await client.createCollection(collectionName, {
            vectors: {
              size: BGE_M3_VECTOR_SIZE,
              distance: 'Cosine',
            },
          });

          // Create payload indices for filtered search
          await client.createPayloadIndex(collectionName, {
            field_name: 'document_type',
            field_schema: 'keyword',
          });
          await client.createPayloadIndex(collectionName, {
            field_name: 'source_id',
            field_schema: 'keyword',
          });

          created.push(collectionName);
          this.logger.log(`Collection ${collectionName} created with payload indices.`);
        } else {
          this.logger.log(`Collection ${collectionName} already exists.`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to initialize collection ${collectionName}: ${error.message}`,
          error.stack,
        );
      }
    }

    return created;
  }

  // ---------------------------------------------------------------------------
  // Single Document Ingestion (from file)
  // ---------------------------------------------------------------------------

  /**
   * Ingest a single document from a file path.
   */
  async ingestDocument(
    documentType: DocumentType,
    filePath: string,
    metadata: Record<string, any> = {},
    chunkerOpts?: ChunkerOptions,
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const fileName = path.basename(filePath);
    const documentId = metadata.documentId || this.generateDocumentId(filePath);
    const errors: string[] = [];

    this.logger.log(
      `[Ingest] Starting: type=${documentType}, file="${fileName}", id=${documentId}`,
    );

    // 1. Read file
    let rawText: string;
    try {
      rawText = await this.readFile(filePath);
    } catch (error) {
      const msg = `Failed to read file "${filePath}": ${error.message}`;
      this.logger.error(msg);
      return {
        documentId,
        documentType,
        fileName,
        chunksGenerated: 0,
        pointsUpserted: 0,
        errors: [msg],
        durationMs: Date.now() - startTime,
      };
    }

    if (!rawText || rawText.trim().length === 0) {
      return {
        documentId,
        documentType,
        fileName,
        chunksGenerated: 0,
        pointsUpserted: 0,
        errors: ['File is empty or unreadable'],
        durationMs: Date.now() - startTime,
      };
    }

    // Hashing document content for pre-ingestion check (Phase 4)
    let fileHash: string;
    try {
      const fileBuffer = fs.readFileSync(filePath);
      fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const alreadyIngested = await this.cacheService.isDocumentIngested(fileHash);
      if (alreadyIngested) {
        this.logger.log(`[Ingest] Document "${fileName}" already ingested (SHA-256: ${fileHash}). Skipping.`);
        return {
          documentId,
          documentType,
          fileName,
          chunksGenerated: 0,
          pointsUpserted: 0,
          errors: [],
          durationMs: Date.now() - startTime,
        };
      }
    } catch (err: any) {
      this.logger.warn(`Pre-ingestion hash check failed for "${fileName}": ${err.message}`);
    }

    // Delegate to the core pipeline
    const result = await this.ingestRawText(documentType, rawText, {
      ...metadata,
      documentId,
      fileName,
    }, chunkerOpts);

    if (result.errors.length === 0 && result.pointsUpserted > 0 && fileHash) {
      await this.cacheService.recordIngestedDocument(fileHash);
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Raw Text Ingestion (no file I/O)
  // ---------------------------------------------------------------------------

  /**
   * Ingest raw text directly — useful for API calls and CLI piping.
   */
  async ingestText(
    documentType: DocumentType,
    text: string,
    metadata: Record<string, any> = {},
    chunkerOpts?: ChunkerOptions,
  ): Promise<IngestionResult> {
    const documentId = metadata.documentId || this.generateDocumentId(text);
    const fileName = metadata.fileName || `inline_${documentType}_${documentId.substring(0, 8)}`;

    return this.ingestRawText(documentType, text, {
      ...metadata,
      documentId,
      fileName,
    }, chunkerOpts);
  }

  // ---------------------------------------------------------------------------
  // Batch Ingestion (directory)
  // ---------------------------------------------------------------------------

  /**
   * Ingest all files in a directory.
   */
  async ingestDirectory(
    documentType: DocumentType,
    dirPath: string,
    metadata: Record<string, any> = {},
    chunkerOpts?: ChunkerOptions,
  ): Promise<BatchIngestionResult> {
    const startTime = Date.now();
    const results: IngestionResult[] = [];
    let successful = 0;
    let failed = 0;

    // Ensure collections exist
    await this.initializeCollections();

    // Read directory
    let files: string[];
    try {
      const entries = fs.readdirSync(dirPath);
      files = entries
        .filter((f) => {
          const ext = path.extname(f).toLowerCase();
          return ['.txt', '.pdf', '.json', '.md'].includes(ext);
        })
        .map((f) => path.join(dirPath, f));
    } catch (error) {
      this.logger.error(`Failed to read directory "${dirPath}": ${error.message}`);
      return {
        totalDocuments: 0,
        successful: 0,
        failed: 0,
        results: [],
        totalDurationMs: Date.now() - startTime,
      };
    }

    this.logger.log(
      `[BatchIngest] Found ${files.length} files in "${dirPath}" for type=${documentType}`,
    );

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      this.logger.log(
        `[BatchIngest] Processing file ${i + 1}/${files.length}: ${path.basename(filePath)}`,
      );

      try {
        const result = await this.ingestDocument(
          documentType,
          filePath,
          { ...metadata },
          chunkerOpts,
        );
        results.push(result);

        if (result.errors.length === 0) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        results.push({
          documentId: this.generateDocumentId(filePath),
          documentType,
          fileName: path.basename(filePath),
          chunksGenerated: 0,
          pointsUpserted: 0,
          errors: [error.message],
          durationMs: 0,
        });
      }
    }

    const totalDurationMs = Date.now() - startTime;
    this.logger.log(
      `[BatchIngest] Complete: ${successful} succeeded, ${failed} failed, total ${totalDurationMs}ms`,
    );

    return {
      totalDocuments: files.length,
      successful,
      failed,
      results,
      totalDurationMs,
    };
  }

  // ---------------------------------------------------------------------------
  // Core Pipeline (shared by file + text ingestion)
  // ---------------------------------------------------------------------------

  private async ingestRawText(
    documentType: DocumentType,
    rawText: string,
    metadata: Record<string, any>,
    chunkerOpts?: ChunkerOptions,
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const documentId = metadata.documentId;
    const fileName = metadata.fileName || 'inline';
    const errors: string[] = [];

    // 1. Chunk
    let chunks: DocumentChunk[];
    try {
      chunks = this.chunkDocument(documentType, rawText, metadata, chunkerOpts);
      this.logger.log(`[Ingest] ${chunks.length} chunks generated from "${fileName}"`);
    } catch (error) {
      const msg = `Chunking failed for "${fileName}": ${error.message}`;
      this.logger.error(msg);
      return {
        documentId,
        documentType,
        fileName,
        chunksGenerated: 0,
        pointsUpserted: 0,
        errors: [msg],
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Generate embeddings via BGE-M3 sidecar
    const texts = chunks.map((c) => c.text);
    let embeddings: number[][];

    try {
      embeddings = await this.generateEmbeddingsViaBgeM3(texts);
      this.logger.log(`[Ingest] ${embeddings.length} BGE-M3 embeddings generated`);
    } catch (error) {
      const msg = `BGE-M3 embedding generation failed for "${fileName}": ${error.message}`;
      this.logger.error(msg);
      return {
        documentId,
        documentType,
        fileName,
        chunksGenerated: chunks.length,
        pointsUpserted: 0,
        errors: [msg],
        durationMs: Date.now() - startTime,
      };
    }

    // 3. Upsert to Qdrant
    const collection = COLLECTION_MAP[documentType];
    let pointsUpserted = 0;

    try {
      pointsUpserted = await this.upsertToQdrant(
        collection,
        documentId,
        chunks,
        embeddings,
        metadata,
      );
      this.logger.log(
        `[Ingest] ${pointsUpserted} points upserted to "${collection}" for "${fileName}"`,
      );
    } catch (error) {
      errors.push(`Qdrant upsert failed: ${error.message}`);
      this.logger.error(`[Ingest] Qdrant upsert failed: ${error.message}`, error.stack);
    }

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `[Ingest] Completed "${fileName}" in ${durationMs}ms — ${pointsUpserted} points stored`,
    );

    return {
      documentId,
      documentType,
      fileName,
      chunksGenerated: chunks.length,
      pointsUpserted,
      errors,
      durationMs,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private chunkDocument(
    type: DocumentType,
    text: string,
    metadata: Record<string, any>,
    opts?: ChunkerOptions,
  ): DocumentChunk[] {
    switch (type) {
      case 'judgment':
      case 'supreme_court_cases':
      case 'high_court_cases':
        return chunkJudgment(text, opts);
      case 'constitution':
        return chunkBareAct(text, 'Constitution of India', opts);
      case 'bns':
        return chunkBareAct(text, 'Bharatiya Nyaya Sanhita', opts);
      case 'bnss':
        return chunkBareAct(text, 'Bharatiya Nagarik Suraksha Sanhita', opts);
      case 'act':
      case 'bare_acts':
        return chunkBareAct(text, metadata.act_name || metadata.title || 'Bare Act', opts);
      case 'paper':
      case 'research_papers':
        return chunkResearchPaper(text, opts);
      case 'user_documents':
        return chunkGeneric(text, type, opts);
      default:
        return chunkGeneric(text, type, opts);
    }
  }

  private async readFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
      // Dynamic import of pdf-parse to avoid startup crash if not installed
      try {
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        return data.text;
      } catch (error) {
        throw new Error(
          `PDF parsing failed for "${filePath}". Ensure pdf-parse is installed: npm i pdf-parse. Error: ${error.message}`,
        );
      }
    }

    if (ext === '.json') {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      // Support { text: "..." } or { content: "..." } shapes
      return parsed.text || parsed.content || JSON.stringify(parsed);
    }

    // .txt, .md, and other text files
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Generate embeddings using the BGE-M3 sidecar.
   * Uses batch endpoint first, falls back to sequential on failure.
   */
  private async generateEmbeddingsViaBgeM3(texts: string[]): Promise<number[][]> {
    // Try batch API first
    try {
      return await this.bgeM3Provider.generateBatchEmbeddings(texts);
    } catch (batchError) {
      this.logger.warn(
        `BGE-M3 batch embedding failed: ${batchError.message}. Falling back to sequential.`,
      );
    }

    // Fallback: sequential with concurrency control (5 at a time)
    const CONCURRENCY = 5;
    const results: number[][] = new Array(texts.length);
    for (let i = 0; i < texts.length; i += CONCURRENCY) {
      const batch = texts.slice(i, i + CONCURRENCY);
      const promises = batch.map((text, j) =>
        this.bgeM3Provider
          .generateEmbedding(text)
          .then((vec) => {
            results[i + j] = vec;
          }),
      );
      await Promise.all(promises);
    }
    return results;
  }

  /**
   * Upsert chunk vectors + payloads to Qdrant in batches.
   */
  private async upsertToQdrant(
    collection: string,
    documentId: string,
    chunks: DocumentChunk[],
    embeddings: number[][],
    metadata: Record<string, any>,
  ): Promise<number> {
    const client = this.qdrantService.getClient();
    let upserted = 0;

    for (let i = 0; i < chunks.length; i += this.UPSERT_BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + this.UPSERT_BATCH_SIZE);
      const batchEmbeddings = embeddings.slice(i, i + this.UPSERT_BATCH_SIZE);

      const points = batchChunks.map((chunk, j) => ({
        id: this.generatePointId(documentId, chunk.chunkIndex),
        vector: batchEmbeddings[j],
        payload: {
          text: chunk.text,
          source_id: documentId,
          document_type: metadata.documentType || null,
          chunk_index: chunk.chunkIndex,
          total_chunks: chunk.totalChunks,
          section: chunk.section || null,
          ...chunk.metadata,
          ...metadata,
          ingested_at: new Date().toISOString(),
        },
      }));

      await client.upsert(collection, {
        wait: true,
        points,
      });

      upserted += points.length;
    }

    return upserted;
  }

  /**
   * Generate a deterministic document ID from the input string.
   */
  private generateDocumentId(input: string): string {
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    return hash.substring(0, 16);
  }

  /**
   * Generate a deterministic UUID-format point ID for Qdrant.
   */
  private generatePointId(documentId: string, chunkIndex: number): string {
    const raw = `${documentId}::chunk_${chunkIndex}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      hash.substring(12, 16),
      hash.substring(16, 20),
      hash.substring(20, 32),
    ].join('-');
  }
}
