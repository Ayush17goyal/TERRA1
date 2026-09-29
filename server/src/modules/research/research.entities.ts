import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class ResearchUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'full_name', nullable: true })
  fullName: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('research_queries')
export class ResearchQuery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  topic: string;

  @Column({ name: 'research_mode' })
  researchMode: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'processing' | 'completed';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => ResearchUser)
  @JoinColumn({ name: 'user_id' })
  user: ResearchUser;
}

@Entity('research_reports')
export class ResearchReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'query_id', type: 'uuid' })
  queryId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column('simple-json', { name: 'research_outline', nullable: true })
  researchOutline: Record<string, unknown>;

  @Column({ name: 'research_mode' })
  researchMode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => ResearchQuery)
  @JoinColumn({ name: 'query_id' })
  query: ResearchQuery;
}

@Entity('research_sources')
export class ResearchSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @Column({ name: 'source_type' })
  sourceType: 'case' | 'act' | 'article' | 'note';

  @Column()
  title: string;

  @Column({ nullable: true })
  citation: string;

  @Column({ nullable: true })
  court: string;

  @Column({ type: 'integer', nullable: true })
  year: number;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ name: 'source_url', nullable: true })
  sourceUrl: string;

  @Column('simple-json', { nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ResearchReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: ResearchReport;
}

@Entity('research_notes')
export class ResearchNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => ResearchReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: ResearchReport;
}

@Entity('saved_reports')
@Unique(['userId', 'reportId'])
export class SavedReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ResearchReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: ResearchReport;
}

@Entity('research_assets')
export class ResearchAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string;

  @Column({ name: 'asset_type' })
  assetType: 'case_matrix' | 'issue_checklist' | 'argument_map';

  @Column('simple-json', { name: 'asset_data', nullable: true })
  assetData: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ResearchReport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: ResearchReport;
}

@Entity('research_documents')
export class ResearchDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'query_id', type: 'uuid', nullable: true })
  queryId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column({ name: 'doc_category' })
  docCategory: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ default: 'Processing' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ResearchQuery, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'query_id' })
  query: ResearchQuery;
}

@Entity('judgment_reports')
export class JudgmentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'research_topic', type: 'text' })
  researchTopic: string;

  @Column({ name: 'case_name', type: 'text', nullable: true })
  caseName: string;

  @Column({ type: 'text', nullable: true })
  citation: string;

  @Column({ type: 'text', nullable: true })
  court: string;

  @Column({ type: 'text', nullable: true })
  judge: string;

  @Column('simple-json', { nullable: true })
  facts: any;

  @Column('simple-json', { nullable: true })
  issues: any;

  @Column('simple-json', { nullable: true })
  holdings: any;

  @Column({ name: 'ratio_decidendi', type: 'text', nullable: true })
  ratioDecidendi: string;

  @Column({ name: 'obiter_dicta', type: 'text', nullable: true })
  obiterDicta: string;

  @Column({ name: 'relief_granted', type: 'text', nullable: true })
  reliefGranted: string;

  @Column({ name: 'impact_analysis', type: 'text', nullable: true })
  impactAnalysis: string;

  @Column('simple-json', { name: 'research_matrix', nullable: true })
  researchMatrix: any;

  @Column({ name: 'generated_report', type: 'text' })
  generatedReport: string;

  @Column({ name: 'file_name', type: 'text', nullable: true })
  fileName: string;

  @Column('simple-json', { nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
