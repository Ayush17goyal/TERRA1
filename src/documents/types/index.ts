import type { KnowledgeDocument, KnowledgeRepository } from '../../knowledge/types';

export type SupportedFileKind = 'pdf' | 'docx' | 'txt' | 'markdown';
export type PipelineDocumentType = 'bare_act' | 'student_draft' | 'assignment' | 'rubric' | 'teacher_material' | 'notes' | 'unknown';

export type BareActComponentType =
  | 'title'
  | 'preamble'
  | 'part'
  | 'chapter'
  | 'section'
  | 'sub_section'
  | 'schedule'
  | 'definition'
  | 'rule_making_power'
  | 'offence'
  | 'penalty'
  | 'savings'
  | 'repeal'
  | 'commencement'
  | 'extent'
  | 'general';

export interface UploadedDocumentInput {
  fileName: string;
  mimeType: string;
  content: Uint8Array;
  userId: string;
  projectId?: string;
  declaredType?: PipelineDocumentType;
  jurisdiction?: string;
}

export interface StoredDocumentObject {
  storagePath: string;
  publicUrl?: string;
  sizeBytes: number;
}

export interface DocumentRecord {
  id: string;
  checksum: string;
  version: number;
  fileName: string;
  mimeType: string;
  fileKind: SupportedFileKind;
  documentType: PipelineDocumentType;
  userId: string;
  projectId?: string;
  jurisdiction?: string;
  storagePath: string;
  status: 'uploaded' | 'processing' | 'indexed' | 'failed' | 'duplicate';
  createdAt: string;
  updatedAt: string;
}

export interface ParsedDocument {
  text: string;
  pageCount?: number;
  metadata: Record<string, unknown>;
}

export interface ClassificationResult {
  documentType: PipelineDocumentType;
  confidence: number;
  reasons: string[];
}

export interface BareActStructureComponent {
  id: string;
  componentType: BareActComponentType;
  title?: string;
  heading?: string;
  sectionNumber?: string;
  text: string;
  order: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentType: PipelineDocumentType;
  componentType: BareActComponentType;
  content: string;
  heading?: string;
  sectionNumber?: string;
  jurisdiction?: string;
  tokenCount: number;
  embeddingVersion: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

export interface DocumentPipelineResult {
  document: DocumentRecord;
  classification: ClassificationResult;
  components: BareActStructureComponent[];
  chunks: DocumentChunk[];
  duplicate: boolean;
  telemetry: DocumentPipelineTelemetryRecord;
}

export interface DocumentPipelineTelemetryRecord {
  documentId: string;
  processingTimeMs: number;
  parsingSuccess: boolean;
  classificationConfidence: number;
  embeddingLatencyMs: number;
  indexingLatencyMs: number;
  chunkCount: number;
  errors: string[];
}

export interface VirusScanner {
  scan(input: UploadedDocumentInput): Promise<{ safe: boolean; reason?: string }>;
}

export interface DocumentStorage {
  upload(input: UploadedDocumentInput, documentId: string, version: number): Promise<StoredDocumentObject>;
}

export interface DocumentParser {
  supports(fileKind: SupportedFileKind, mimeType: string): boolean;
  parse(input: UploadedDocumentInput): Promise<ParsedDocument>;
}

export interface DocumentRepository {
  findByChecksum(checksum: string, userId: string): Promise<DocumentRecord | undefined>;
  create(record: DocumentRecord): Promise<void>;
  update(id: string, patch: Partial<DocumentRecord>): Promise<void>;
  nextVersion(checksum: string, userId: string): Promise<number>;
}

export interface EmbeddingGenerator {
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

export interface DocumentIndexer {
  index(chunks: DocumentChunk[]): Promise<void>;
}

export interface DocumentPipelineServices {
  storage: DocumentStorage;
  repository: DocumentRepository;
  scanner: VirusScanner;
  parsers: DocumentParser[];
  embeddings: EmbeddingGenerator;
  indexer: DocumentIndexer;
}

export interface KnowledgeRepositoryIndexerOptions {
  repository: KnowledgeRepository;
}

export function toKnowledgeDocuments(chunks: DocumentChunk[]): KnowledgeDocument[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    kind: chunk.documentType === 'bare_act' ? 'bare_act_component' : 'student_state',
    title: chunk.heading ?? chunk.sectionNumber ?? chunk.componentType,
    content: chunk.content,
    metadata: {
      document_id: chunk.documentId,
      document_type: chunk.documentType,
      component_type: chunk.componentType,
      jurisdiction: chunk.jurisdiction,
      section_number: chunk.sectionNumber,
      heading: chunk.heading,
      token_count: chunk.tokenCount,
      embedding_version: chunk.embeddingVersion,
      ...chunk.metadata,
    },
    embedding: chunk.embedding,
  }));
}
