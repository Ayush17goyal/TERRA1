import { DocumentClassifier } from '../classification/DocumentClassifier';
import { DocumentChunker } from '../chunking/DocumentChunker';
import { DocumentEmbeddingService } from '../embeddings/DocumentEmbeddingService';
import { BareActStructureExtractor } from '../extraction/BareActStructureExtractor';
import { TextNormalizer } from '../normalization/TextNormalizer';
import { DocumentTelemetry } from '../telemetry/DocumentTelemetry';
import type {
  BareActStructureComponent,
  DocumentPipelineResult,
  DocumentPipelineServices,
  DocumentRecord,
  ParsedDocument,
  SupportedFileKind,
  UploadedDocumentInput,
} from '../types';
import { parseUploadedDocumentInput } from '../validators/schemas';
import { ChecksumService } from '../upload/ChecksumService';
import { FileTypeDetector } from '../upload/FileTypeDetector';

export interface DocumentPipelineOptions {
  services: DocumentPipelineServices;
  embeddingVersion?: string;
  telemetry?: DocumentTelemetry;
}

export class DocumentPipeline {
  private readonly services: DocumentPipelineServices;
  private readonly embeddingVersion: string;
  private readonly telemetry: DocumentTelemetry;
  private readonly checksum = new ChecksumService();
  private readonly fileTypes = new FileTypeDetector();
  private readonly normalizer = new TextNormalizer();
  private readonly classifier = new DocumentClassifier();
  private readonly extractor = new BareActStructureExtractor();
  private readonly chunker = new DocumentChunker();

  constructor(options: DocumentPipelineOptions) {
    this.services = options.services;
    this.embeddingVersion = options.embeddingVersion ?? 'text-embedding-3-small-v1';
    this.telemetry = options.telemetry ?? new DocumentTelemetry();
  }

  async process(inputRaw: UploadedDocumentInput): Promise<DocumentPipelineResult> {
    const started = Date.now();
    const errors: string[] = [];
    let documentId = crypto.randomUUID();
    let parsingSuccess = false;
    let classificationConfidence = 0;
    let embeddingLatencyMs = 0;
    let indexingLatencyMs = 0;

    const input = parseUploadedDocumentInput(inputRaw);
    const fileKind = this.fileTypes.detect(input);
    const checksum = await this.checksum.sha256(input.content);
    const existing = await this.services.repository.findByChecksum(checksum, input.userId);

    if (existing) {
      const telemetry = {
        documentId: existing.id,
        processingTimeMs: Date.now() - started,
        parsingSuccess: true,
        classificationConfidence: 1,
        embeddingLatencyMs: 0,
        indexingLatencyMs: 0,
        chunkCount: 0,
        errors,
      };
      this.telemetry.record(telemetry);
      return {
        document: { ...existing, status: 'duplicate' },
        classification: { documentType: existing.documentType, confidence: 1, reasons: ['checksum_duplicate'] },
        components: [],
        chunks: [],
        duplicate: true,
        telemetry,
      };
    }

    const version = await this.services.repository.nextVersion(checksum, input.userId);
    const storage = await this.services.storage.upload(input, documentId, version);
    const now = new Date().toISOString();
    const baseRecord: DocumentRecord = {
      id: documentId,
      checksum,
      version,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileKind,
      documentType: input.declaredType ?? 'unknown',
      userId: input.userId,
      projectId: input.projectId,
      jurisdiction: input.jurisdiction,
      storagePath: storage.storagePath,
      status: 'processing',
      createdAt: now,
      updatedAt: now,
    };
    await this.services.repository.create(baseRecord);

    try {
      const scan = await this.services.scanner.scan(input);
      if (!scan.safe) throw new Error(`Document failed scanner check: ${scan.reason ?? 'unsafe'}`);

      const parsed = await this.parse(fileKind, input);
      parsingSuccess = true;
      const normalized = this.normalizer.normalize(parsed.text);
      const classification = this.classifier.classify(normalized, input.declaredType);
      classificationConfidence = classification.confidence;
      const components = this.extractComponents(normalized, classification.documentType, parsed);
      let chunks = this.chunker.chunk({
        documentId,
        documentType: classification.documentType,
        components,
        jurisdiction: input.jurisdiction,
        embeddingVersion: this.embeddingVersion,
      });

      const embeddingStart = Date.now();
      chunks = await new DocumentEmbeddingService(this.services.embeddings).embed(chunks);
      embeddingLatencyMs = Date.now() - embeddingStart;

      const indexingStart = Date.now();
      await this.services.indexer.index(chunks);
      indexingLatencyMs = Date.now() - indexingStart;

      const document: DocumentRecord = {
        ...baseRecord,
        documentType: classification.documentType,
        status: 'indexed',
        updatedAt: new Date().toISOString(),
      };
      await this.services.repository.update(documentId, document);

      const telemetry = {
        documentId,
        processingTimeMs: Date.now() - started,
        parsingSuccess,
        classificationConfidence,
        embeddingLatencyMs,
        indexingLatencyMs,
        chunkCount: chunks.length,
        errors,
      };
      this.telemetry.record(telemetry);

      return { document, classification, components, chunks, duplicate: false, telemetry };
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      errors.push(normalizedError.message);
      await this.services.repository.update(documentId, { status: 'failed' });
      const telemetry = {
        documentId,
        processingTimeMs: Date.now() - started,
        parsingSuccess,
        classificationConfidence,
        embeddingLatencyMs,
        indexingLatencyMs,
        chunkCount: 0,
        errors,
      };
      this.telemetry.record(telemetry);
      throw normalizedError;
    }
  }

  private async parse(fileKind: SupportedFileKind, input: UploadedDocumentInput): Promise<ParsedDocument> {
    const parser = this.services.parsers.find((candidate) => candidate.supports(fileKind, input.mimeType));
    if (!parser) throw new Error(`No parser configured for ${fileKind}`);
    return parser.parse(input);
  }

  private extractComponents(text: string, documentType: DocumentRecord['documentType'], parsed: ParsedDocument): BareActStructureComponent[] {
    if (documentType === 'bare_act') {
      return this.extractor.extract(text);
    }
    return [{
      id: 'component-0',
      componentType: 'general',
      heading: String(parsed.metadata.title ?? 'Document'),
      text,
      order: 0,
    }];
  }
}


