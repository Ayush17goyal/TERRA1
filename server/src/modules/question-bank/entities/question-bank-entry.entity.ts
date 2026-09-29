import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { PlannedQuestionType, QuestionMarkValue } from '../../question-planning/question-planning.types';
import {
  BoundEntityReference,
  QuestionDifficulty,
  QuestionValidationStatus,
  RubricComponent,
} from '../question-bank.types';
import { SourceReference } from '../../knowledge-engine/knowledge-engine.types';

@Entity('question_bank_entries')
@Index(['userId', 'slotId'], { unique: true })
@Index(['userId', 'topic', 'subtopic', 'questionType', 'markValue', 'validationStatus'])
export class QuestionBankEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @Column({ name: 'slot_id' })
  slotId: string;

  @Column({ name: 'tku_id' })
  tkuId: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'varchar', name: 'question_type' })
  questionType: PlannedQuestionType;

  @Column({ type: 'varchar' })
  difficulty: QuestionDifficulty;

  @Column()
  topic: string;

  @Column()
  subtopic: string;

  @Column({ type: 'int', name: 'mark_value' })
  markValue: QuestionMarkValue;

  @Column('simple-json')
  rubric: RubricComponent[];

  @Column('simple-json', { name: 'bound_entity_refs' })
  boundEntityRefs: BoundEntityReference[];

  @Column('simple-json', { name: 'grounding_sources' })
  groundingSources: SourceReference[];

  @Column({ type: 'float', name: 'quality_score', default: 0 })
  qualityScore: number;

  @Column({ type: 'text', name: 'model_answer', nullable: true, default: null })
  modelAnswer: string | null;

  @Column({ type: 'varchar', name: 'validation_status' })
  validationStatus: QuestionValidationStatus;

  @Column('simple-array', { name: 'validation_reasons', nullable: true })
  validationReasons: string[];

  @Column({ type: 'int', name: 'source_tku_version', default: 1 })
  sourceTkuVersion: number;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
