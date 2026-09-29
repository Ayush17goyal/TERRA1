import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { ModelAnswerComponent, ModelAnswerKeyword, ModelAnswerValidationStatus } from '../model-answer.types';
import { SourceReference } from '../../knowledge-engine/knowledge-engine.types';
import { BoundEntityReference } from '../../question-bank/question-bank.types';

@Entity('model_answer_entries')
@Index(['userId', 'questionId'], { unique: true })
@Index(['userId', 'validationStatus'])
export class ModelAnswerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'question_id' })
  questionId: string;

  @Column({ name: 'tku_id' })
  tkuId: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'int', name: 'mark_value' })
  markValue: number;

  @Column('simple-json')
  components: ModelAnswerComponent[];

  @Column('simple-json', { name: 'examiner_keywords' })
  examinerKeywords: ModelAnswerKeyword[];

  @Column('simple-json', { name: 'bound_entity_refs' })
  boundEntityRefs: BoundEntityReference[];

  @Column('simple-json', { name: 'grounding_sources' })
  groundingSources: SourceReference[];

  @Column({ type: 'float', name: 'quality_score', default: 0 })
  qualityScore: number;

  @Column({ type: 'varchar', name: 'validation_status' })
  validationStatus: ModelAnswerValidationStatus;

  @Column('simple-array', { name: 'validation_reasons', nullable: true })
  validationReasons: string[];

  @Column({ type: 'int', name: 'source_question_version', default: 1 })
  sourceQuestionVersion: number;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
