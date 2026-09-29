import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, Index } from 'typeorm';
import { DocumentEngineStatus, SourceDocumentType } from '../types/document-graph.types';
import { DocumentKnowledgeRecordEntity } from './document-knowledge-record.entity';

// Persisted counterpart of "IngestedDocument" (architecture.md §3): tracks a single
// uploaded file through the ingestion pipeline (Stages 0-12) and the validation gates in §3.3.
@Entity('document_engine_documents')
export class IngestedDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'original_filename' })
  originalFilename: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes' })
  sizeBytes: number;

  @Column({ name: 'storage_path' })
  storagePath: string;

  // SHA-256 of the raw file bytes. Used by the duplicate-detection gate (§3.3) to
  // short-circuit an exact re-upload back to the existing record instead of reprocessing.
  @Index()
  @Column({ name: 'content_hash' })
  contentHash: string;

  @Column({ type: 'varchar', default: 'queued' })
  status: DocumentEngineStatus;

  @Column({ type: 'varchar', name: 'document_type', default: 'unknown' })
  documentType: SourceDocumentType;

  @Column({ nullable: true, default: 'en' })
  language: string;

  @Column({ name: 'ocr_used', default: false })
  ocrUsed: boolean;

  @Column({ type: 'float', name: 'confidence_score', default: 0 })
  confidenceScore: number;

  @Column({ name: 'needs_review', default: false })
  needsReview: boolean;

  @Column('simple-array', { name: 'review_reasons', nullable: true })
  reviewReasons: string[];

  // Per-stage completion tracking, consumed by the status endpoint and by the
  // resumability contract in architecture.md §3 / §12.2 (job keyed by entityId+stageName).
  @Column('simple-json', { name: 'stage_progress', nullable: true })
  stageProgress: Record<string, 'pending' | 'in_progress' | 'completed' | 'failed'>;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'document_type_hint', nullable: true })
  documentTypeHint: string;

  @OneToOne(() => DocumentKnowledgeRecordEntity, (record) => record.document)
  knowledgeRecord: DocumentKnowledgeRecordEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
