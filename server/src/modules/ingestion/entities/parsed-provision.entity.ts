import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('parsed_provisions')
export class ParsedProvisionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'act_name' })
  actName: string;

  @Index()
  @Column({ name: 'act_id', default: '' })
  actId: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  part: string;

  @Column({ nullable: true })
  chapter: string;

  @Column({ nullable: true })
  section: string;

  @Column({ nullable: true })
  subsection: string;

  @Column({ nullable: true })
  clause: string;

  @Column({ nullable: true })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column('simple-array')
  keywords: string[];

  @Index()
  @Column({ name: 'content_hash', default: '' })
  contentHash: string;

  @Index()
  @Column({ name: 'pdf_source' })
  pdfSource: string;

  /** Set to true once a vector has been successfully upserted into Qdrant */
  @Column({ name: 'embedding_synced', default: false })
  embeddingSynced: boolean;

  /** Version tag of the embedding model used (e.g. 'bge-m3-v1', 'openai-te3-small-1024') */
  @Column({ name: 'embedding_version', nullable: true })
  embeddingVersion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

