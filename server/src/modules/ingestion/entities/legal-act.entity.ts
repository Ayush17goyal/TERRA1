import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('legal_acts')
export class LegalActEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'act_name' })
  actName: string;

  @Index()
  @Column({ name: 'act_id', default: '' })
  actId: string;

  @Column({ name: 'short_name', default: '' })
  shortName: string;

  @Column('simple-json', { default: '[]' })
  aliases: string[];

  @Column({ nullable: true })
  year?: number;

  @Column({ default: 'active' })
  status: string;

  @Column()
  category: string;

  @Index({ unique: true })
  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'file_size_bytes' })
  fileSizeBytes: number;

  @Column({ name: 'last_modified_date' })
  lastModifiedDate: Date;

  @Column({ name: 'pdf_hash', nullable: true })
  pdfHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

