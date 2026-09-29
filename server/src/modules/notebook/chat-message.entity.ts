import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notebook_chat_messages')
export class NotebookChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column()
  role: 'user' | 'assistant';

  @Column('text')
  text: string;

  @Column('simple-json', { nullable: true })
  citations: any;

  @Column({ type: 'float', nullable: true })
  confidence: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
