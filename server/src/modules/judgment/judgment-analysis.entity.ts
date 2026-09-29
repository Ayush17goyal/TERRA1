import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('judgment_analyses')
export class JudgmentAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  citation: string;

  @Column({ nullable: true })
  court: string;

  @Column({ nullable: true })
  bench: string;

  @Column({ name: 'date_of_judgment', nullable: true })
  dateOfJudgment: string;

  @Column('simple-json', { default: '[]' })
  judges: string[];

  @Column('text')
  facts: string;

  @Column('simple-json', { default: '[]' })
  issues: string[];

  @Column('simple-json', { name: 'arguments_petitioner', default: '[]' })
  argumentsPetitioner: string[];

  @Column('simple-json', { name: 'arguments_respondent', default: '[]' })
  argumentsRespondent: string[];

  @Column('simple-json', { default: '[]' })
  statutes: string[];

  @Column('simple-json', { default: '[]' })
  precedents: string[];

  @Column('text', { name: 'ratio_decidendi' })
  ratioDecidendi: string;

  @Column('text', { name: 'obiter_dicta', nullable: true })
  obiterDicta: string;

  @Column('text')
  holding: string;

  @Column('text', { name: 'final_verdict' })
  finalVerdict: string;

  @Column('simple-json', { default: '[]' })
  timeline: { year: string; event: string }[];

  @Column('simple-json', { name: 'citation_network', default: '[]' })
  citationNetwork: { case: string; relationship: string; relevance: string }[];

  @Column({ type: 'integer', name: 'exam_relevance_score', default: 0 })
  examRelevanceScore: number;

  @Column({ type: 'integer', name: 'landmark_impact_score', default: 0 })
  landmarkImpactScore: number;

  @Column('simple-json', { name: 'source_chunk_refs', nullable: true })
  sourceChunkRefs: { field: string; chunkIndex: number; pageNumber: number; excerpt: string }[];

  @Column('text', { name: 'revision_notes', nullable: true })
  revisionNotes: string;

  @Column('simple-json', { name: 'moot_court_kit', nullable: true })
  mootCourtKit: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
