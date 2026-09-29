import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type DraftStatus = 'pending' | 'processing' | 'reviewed' | 'failed';

@Entity('draft_analyzer_drafts')
export class Draft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'storage_path', nullable: true })
  storagePath: string;

  @Column({ default: 'pending' })
  status: DraftStatus;

  @Column({ name: 'extracted_at', nullable: true })
  extractedAt: Date | null;

  @Column({ name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
