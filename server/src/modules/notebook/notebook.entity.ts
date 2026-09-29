import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { DocumentChunk } from './chunk.entity';

@Entity('notebook_documents')
export class NotebookDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column()
  size: string;

  @Column({ default: 'Processing' })
  status: string;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  @Column({ default: 0, name: 'word_count' })
  wordCount: number;

  @Column({ default: 0 })
  pages: number;

  @Column({ default: 'User Notes', name: 'document_type' })
  documentType: string;

  @Column({ default: 0, name: 'clauses_count' })
  clausesCount: number;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column('simple-json', { nullable: true, name: 'legal_metadata' })
  legalMetadata: any;

  @Column('simple-json', { nullable: true, name: 'study_forge' })
  studyForge: any;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'storage_path', nullable: true })
  storagePath: string;

  @Column({ name: 'mime_type', nullable: true })
  mimeType: string;

  @Column({ name: 'file_name', nullable: true })
  fileName: string;

  @Column({ name: 'file_type', nullable: true })
  fileType: string;

  @Column({ name: 'storage_url', nullable: true })
  storageUrl: string;

  @Column({ type: 'text', name: 'extracted_text', nullable: true })
  extractedText: string;

  @Column({ name: 'embeddings_status', nullable: true })
  embeddingsStatus: string;

  @Column({ name: 'qdrant_collection', nullable: true })
  qdrantCollection: string;

  @Column({ name: 'indexed_at', nullable: true })
  indexedAt: Date;

  @Column({ name: 'chunk_count', default: 0 })
  chunkCount: number;

  @Column('simple-array', { name: 'topics_detected', nullable: true })
  topicsDetected: string[];

  @OneToMany(() => DocumentChunk, (chunk) => chunk.document, { cascade: true })
  chunks: DocumentChunk[];
}
