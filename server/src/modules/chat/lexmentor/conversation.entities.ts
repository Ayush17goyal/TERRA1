import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('lexmentor_sessions')
@Index(['userId', 'sessionId'], { unique: true })
export class ConversationSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  sessionId: string;

  @Column({ nullable: true })
  title: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'datetime', nullable: true })
  lastActiveAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('lexmentor_turns')
@Index(['sessionId'])
export class ConversationTurn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** References ConversationSession.id (not the external sessionId string) */
  @Column()
  sessionId: string;

  @Column({ type: 'varchar', length: 16 })
  role: 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('lexmentor_analytics')
@Index(['userId'])
@Index(['createdAt'])
export class PipelineAnalyticRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column()
  sessionId: string;

  @Column()
  requestId: string;

  @Column()
  intent: string;

  @Column()
  provider: string;

  @Column()
  model: string;

  @Column({ type: 'int' })
  pipelineTotalMs: number;

  @Column({ type: 'int', default: 0 })
  retrievedChunks: number;

  @Column({ type: 'int', default: 0 })
  promptTokens: number;

  @Column({ type: 'int', default: 0 })
  completionTokens: number;

  @Column({ nullable: true })
  depth: string;

  @Column({ type: 'simple-json', nullable: true })
  stageTimings: Record<string, number>;

  @CreateDateColumn()
  createdAt: Date;
}
