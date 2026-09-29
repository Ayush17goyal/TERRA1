import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { NotebookDocument } from './notebook.entity';

@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @Column({ name: 'document_name', nullable: true })
  documentName: string;

  @Column()
  chunkIndex: number;

  @Column('text')
  text: string;

  @Column({ default: 1 })
  pageNumber: number;

  @Column({ nullable: true })
  section: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => NotebookDocument, (doc) => doc.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: NotebookDocument;
}

