import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ai_learning_sources')
export class AiLearningSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  kind: string;

  @Column({ default: 'Queued' })
  status: string;

  @Column({ name: 'indexing_progress', default: 0 })
  indexingProgress: number;

  @Column({ name: 'document_type', nullable: true })
  documentType: string;

  @Column({ nullable: true })
  subject: string;

  @Column({ nullable: true })
  unit: string;

  @Column({ nullable: true })
  topic: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  url: string;

  @Column({ name: 'storage_path', nullable: true })
  storagePath: string;

  @Column({ name: 'mime_type', nullable: true })
  mimeType: string;

  @Column({ name: 'text_length', default: 0 })
  textLength: number;

  @Column({ name: 'vector_id', nullable: true })
  vectorId: string;

  @Column('simple-json', { default: '{}' })
  metadata: any;

  @Column({ type: 'text' })
  text: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('ai_mock_tests')
export class AiMockTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  topic: string;

  @Column()
  difficulty: string;

  @Column({ name: 'question_type' })
  questionType: string;

  @Column({ name: 'question_count' })
  questionCount: number;

  @Column({ default: 'interactive' })
  mode: string; // 'interactive' | 'pdf'

  @Column({ name: 'pdf_url', nullable: true })
  pdfUrl: string;

  @Column('simple-json', { name: 'source_ids', default: '[]' })
  sourceIds: string[];

  @Column('simple-json', { default: '[]' })
  questions: any[];

  @Column('simple-json', { name: 'score_report', default: '{}' })
  scoreReport: any;

  @Column('simple-json', { name: 'weak_areas', default: '[]' })
  weakAreas: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('ai_mock_test_attempts')
export class AiMockTestAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'mock_test_id' })
  mockTestId: string;

  @Column()
  score: number;

  @Column()
  total: number;

  @Column()
  percentage: number;

  @Column({ name: 'time_taken', default: 0 })
  timeTaken: number; // in seconds

  @Column({ default: 0 })
  accuracy: number; // same as percentage

  @Column('simple-json', { default: '{}' })
  answers: any;

  @Column('simple-json', { name: 'weak_areas', default: '[]' })
  weakAreas: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('ai_mind_maps')
export class AiMindMap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  title: string;

  @Column({ name: 'structure_type', default: 'Quick' })
  structureType: string; // Quick, Detailed, Judiciary, Bare Act

  @Column('simple-json', { name: 'source_ids', default: '[]' })
  sourceIds: string[];

  @Column('simple-json', { default: '{}' })
  map: any;

  @Column('simple-json', { default: '[]' })
  concepts: string[];

  @Column('simple-json', { name: 'coverage_metrics', nullable: true })
  coverageMetrics: {
    totalConcepts: number;
    pagesAnalyzed: number;
    chunksUsed: number;
    sourceConfidence: number;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('ai_study_kits')
export class AiStudyKit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  title: string;

  @Column('simple-json', { name: 'source_ids', default: '[]' })
  sourceIds: string[];

  @Column('simple-json', { default: '{}' })
  content: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('ai_flashcard_reviews')
export class AiFlashcardReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'study_kit_id' })
  studyKitId: string;

  @Column({ name: 'card_id' })
  cardId: string;

  @Column()
  rating: string;

  @Column()
  correct: boolean;

  @Column({ nullable: true })
  topic: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('ai_learning_activity')
export class AiLearningActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  action: string;

  @Column('simple-json', { default: '{}' })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('ai_question_vault')
export class AiQuestionVaultItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column()
  subject: string;

  @Column()
  topic: string;

  @Column({ nullable: true })
  subtopic: string;

  @Column({ name: 'legal_domain', nullable: true })
  legalDomain: string;

  @Column({ name: 'question_type' })
  questionType: string;

  @Column({ default: 'Intermediate' })
  difficulty: string;

  @Column({ default: 5 })
  marks: number;

  @Column({ name: 'section_name', nullable: true })
  sectionName: string;

  @Column({ name: 'exam_type', nullable: true })
  examType: string;

  @Column({ nullable: true })
  year: string;

  @Column({ name: 'source_doc_name', nullable: true })
  sourceDocName: string;

  @Column({ name: 'source_doc_no', nullable: true })
  sourceDocNo: string;

  @Column({ type: 'text' })
  question: string;

  @Column('simple-json', { nullable: true })
  options: string[];

  @Column({ name: 'model_answer', type: 'text', nullable: true })
  modelAnswer: string;

  @Column('simple-json', { nullable: true })
  rubric: any;

  @Column({ name: 'legal_ref', nullable: true })
  legalRef: string;

  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @Column('simple-json', { default: '{}' })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

