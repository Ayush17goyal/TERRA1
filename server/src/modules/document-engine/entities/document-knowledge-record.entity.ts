import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { IngestedDocumentEntity } from './ingested-document.entity';
import { DocumentGraph, RetrievableUnit } from '../types/document-graph.types';

// Persisted counterpart of "KnowledgeBaseRecord" (architecture.md §3, Stage 12 output).
// One row per IngestedDocumentEntity, created once Stage 12 completes. Stored as structured
// JSON (matching this codebase's convention for nested legal metadata, e.g. NotebookDocument's
// `legalMetadata`/`studyForge` columns) rather than a deep relational schema — every field below
// is still a typed, structured object per architecture.md's "avoid simple chunking" requirement,
// not raw chunk text.
@Entity('document_engine_knowledge_records')
export class DocumentKnowledgeRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @OneToOne(() => IngestedDocumentEntity, (doc) => doc.knowledgeRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: IngestedDocumentEntity;

  @Column('simple-json')
  graph: DocumentGraph;

  @Column('simple-json', { name: 'retrievable_units' })
  retrievableUnits: RetrievableUnit[];

  @Column('simple-array', { name: 'dominant_topics', nullable: true })
  dominantTopics: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
