import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsIn, IsObject, Min, Max } from 'class-validator';
import { IngestionService, DocumentType } from './ingestion.service';
import { CorpusScannerService } from './corpus-scanner.service';

/**
 * Ingestion Controller
 * =====================
 * REST API endpoints for the BGE-M3 document ingestion pipeline.
 *
 * Routes (all under /api/v1/ingestion):
 *   GET  /status            — Pipeline health + collection stats
 *   POST /init-collections  — Create BGE-M3 Qdrant collections
 *   POST /ingest            — Ingest a single document file
 *   POST /ingest-text       — Ingest raw text (no file required)
 *   POST /ingest-batch      — Ingest all documents in a directory
 */

// ---------------------------------------------------------------------------
// DTOs with class-validator decorators
// ---------------------------------------------------------------------------

class IngestDocumentDto {
  @IsIn(['constitution', 'bare_acts', 'supreme_court_cases', 'high_court_cases', 'research_papers', 'user_documents', 'bns', 'bnss', 'act', 'judgment', 'paper'])
  documentType: DocumentType;

  @IsString()
  filePath: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  @Min(200)
  @Max(4000)
  chunkSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  chunkOverlap?: number;
}

class IngestTextDto {
  @IsIn(['constitution', 'bare_acts', 'supreme_court_cases', 'high_court_cases', 'research_papers', 'user_documents', 'bns', 'bnss', 'act', 'judgment', 'paper'])
  documentType: DocumentType;

  @IsString()
  text: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  @Min(200)
  @Max(4000)
  chunkSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  chunkOverlap?: number;
}

class IngestBatchDto {
  @IsIn(['constitution', 'bare_acts', 'supreme_court_cases', 'high_court_cases', 'research_papers', 'user_documents', 'bns', 'bnss', 'act', 'judgment', 'paper'])
  documentType: DocumentType;

  @IsString()
  directoryPath: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  @Min(200)
  @Max(4000)
  chunkSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  chunkOverlap?: number;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('ingestion')
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(
    private readonly ingestionService: IngestionService,
    private readonly corpusScannerService: CorpusScannerService,
  ) {}

  /**
   * GET /api/v1/ingestion/status
   * Check BGE-M3 sidecar health + Qdrant connection + collection stats.
   */
  @Get('status')
  async getStatus() {
    this.logger.log('GET /status — Checking pipeline health');
    const status = await this.ingestionService.getStatus();
    return {
      success: true,
      status,
    };
  }

  /**
   * POST /api/v1/ingestion/init-collections
   * Create the BGE-M3 vector collections in Qdrant.
   */
  @Post('init-collections')
  async initCollections() {
    this.logger.log('POST /init-collections — Creating BGE-M3 collections');
    const created = await this.ingestionService.initializeCollections();
    return {
      success: true,
      message: created.length > 0
        ? `Created collections: ${created.join(', ')}`
        : 'All collections already exist',
      created,
    };
  }

  /**
   * POST /api/v1/ingestion/ingest
   * Ingest a single document file.
   *
   * Body: {
   *   documentType: "judgment" | "act" | "paper",
   *   filePath: "/absolute/path/to/document.txt",
   *   metadata?: { title: "...", court: "...", ... },
   *   chunkSize?: 1000,
   *   chunkOverlap?: 200
   * }
   */
  @Post('ingest')
  async ingestDocument(@Body() dto: IngestDocumentDto) {
    this.logger.log(
      `POST /ingest — type=${dto.documentType}, file="${dto.filePath}"`,
    );

    // Ensure collections exist
    await this.ingestionService.initializeCollections();

    const result = await this.ingestionService.ingestDocument(
      dto.documentType,
      dto.filePath,
      dto.metadata || {},
      {
        chunkSize: dto.chunkSize,
        chunkOverlap: dto.chunkOverlap,
      },
    );

    return {
      success: result.errors.length === 0,
      result,
    };
  }

  /**
   * POST /api/v1/ingestion/ingest-text
   * Ingest raw text directly (no file path needed).
   *
   * Body: {
   *   documentType: "judgment" | "act" | "paper",
   *   text: "The full text of the document...",
   *   metadata?: { title: "...", ... },
   *   chunkSize?: 1000,
   *   chunkOverlap?: 200
   * }
   */
  @Post('ingest-text')
  async ingestText(@Body() dto: IngestTextDto) {
    this.logger.log(
      `POST /ingest-text — type=${dto.documentType}, textLength=${dto.text.length}`,
    );

    // Ensure collections exist
    await this.ingestionService.initializeCollections();

    const result = await this.ingestionService.ingestText(
      dto.documentType,
      dto.text,
      dto.metadata || {},
      {
        chunkSize: dto.chunkSize,
        chunkOverlap: dto.chunkOverlap,
      },
    );

    return {
      success: result.errors.length === 0,
      result,
    };
  }

  /**
   * POST /api/v1/ingestion/ingest-batch
   * Ingest all documents in a directory.
   *
   * Body: {
   *   documentType: "judgment" | "act" | "paper",
   *   directoryPath: "/absolute/path/to/documents/",
   *   metadata?: { ... },
   *   chunkSize?: 1000,
   *   chunkOverlap?: 200
   * }
   */
  @Post('ingest-batch')
  async ingestBatch(@Body() dto: IngestBatchDto) {
    this.logger.log(
      `POST /ingest-batch — type=${dto.documentType}, dir="${dto.directoryPath}"`,
    );

    const result = await this.ingestionService.ingestDirectory(
      dto.documentType,
      dto.directoryPath,
      dto.metadata || {},
      {
        chunkSize: dto.chunkSize,
        chunkOverlap: dto.chunkOverlap,
      },
    );

    return {
      success: result.failed === 0,
      result,
    };
  }

  /**
   * POST /api/v1/ingestion/scan
   * Recursively scan corpus-data directory and synchronize metadata in SQLite.
   */
  @Post('scan')
  async scanCorpus() {
    this.logger.log('POST /scan — Starting recursive corpus directory scan');
    const report = await this.corpusScannerService.scanCorpus();
    return {
      success: report.errors === 0,
      actsDiscovered: report.actsDiscovered,
      actsParsed: report.actsParsed,
      actsSkipped: report.actsSkipped,
      sectionsStored: report.sectionsStored,
      embeddingsGenerated: report.embeddingsGenerated,
      missingEmbeddings: report.missingEmbeddings,
      errors: report.errors,
      details: report.details,
    };
  }
}
