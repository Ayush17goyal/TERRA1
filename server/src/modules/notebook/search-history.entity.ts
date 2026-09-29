import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notebook_search_history')
export class NotebookSearchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  query: string;

  @Column()
  mode: 'keyword' | 'vector' | 'hybrid';

  @Column({ name: 'document_id', nullable: true })
  documentId: string;

  @Column({ name: 'result_count', default: 0 })
  resultCount: number;

  @Column('simple-array', { nullable: true })
  warnings: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
