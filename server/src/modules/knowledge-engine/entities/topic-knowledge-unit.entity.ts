import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import {
  CaseRecord,
  ComparisonRecord,
  DefinitionRecord,
  ExampleRecord,
  ExceptionRecord,
  PrincipleRecord,
  ProvisionRecord,
  SourceReference,
  TopicKeyword,
} from '../knowledge-engine.types';

@Entity('topic_knowledge_units')
@Index(['userId', 'topic', 'subtopic'], { unique: true })
@Index(['userId', 'coverageScore', 'confidenceScore'])
export class TopicKnowledgeUnitEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  topic: string;

  @Column()
  subtopic: string;

  @Column({ type: 'text', default: '' })
  summary: string;

  @Column('simple-json', { default: '[]' })
  definitions: DefinitionRecord[];

  @Column('simple-json', { name: 'legal_provisions', default: '[]' })
  legalProvisions: ProvisionRecord[];

  @Column('simple-json', { default: '[]' })
  principles: PrincipleRecord[];

  @Column('simple-json', { default: '[]' })
  exceptions: ExceptionRecord[];

  @Column('simple-json', { name: 'landmark_cases', default: '[]' })
  landmarkCases: CaseRecord[];

  @Column('simple-json', { name: 'referenced_cases', default: '[]' })
  referencedCases: CaseRecord[];

  @Column('simple-json', { default: '[]' })
  illustrations: ExampleRecord[];

  @Column('simple-json', { default: '[]' })
  examples: ExampleRecord[];

  @Column('simple-json', { default: '[]' })
  comparisons: ComparisonRecord[];

  @Column('simple-json', { default: '[]' })
  keywords: TopicKeyword[];

  @Column('simple-json', { default: '[]' })
  references: SourceReference[];

  @Column({ type: 'float', name: 'coverage_score', default: 0 })
  coverageScore: number;

  @Column({ type: 'float', name: 'confidence_score', default: 0 })
  confidenceScore: number;

  @VersionColumn()
  version: number;

  @UpdateDateColumn({ name: 'last_updated' })
  lastUpdated: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
