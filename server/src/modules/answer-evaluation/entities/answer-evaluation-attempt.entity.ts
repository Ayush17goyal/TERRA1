import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { ModelAnswerComponent, ModelAnswerKeyword } from '../../model-answer/model-answer.types';
import { RubricComponent } from '../../question-bank/question-bank.types';
import { AnswerEvaluationDimension, AnswerEvaluationStatus, DimensionEvaluation } from '../answer-evaluation.types';

@Entity('answer_evaluation_attempts')
@Index(['userId', 'createdAt'])
@Index(['userId', 'questionId', 'createdAt'])
export class AnswerEvaluationAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'question_id', nullable: true })
  questionId: string | null;

  @Column({ name: 'model_answer_id', nullable: true })
  modelAnswerId: string | null;

  @Column({ type: 'text', name: 'student_answer' })
  studentAnswer: string;

  @Column({ type: 'text' })
  question: string;

  @Column('simple-json')
  rubric: RubricComponent[];

  @Column('simple-json', { name: 'model_answer_components' })
  modelAnswerComponents: ModelAnswerComponent[];

  @Column('simple-json', { name: 'examiner_keywords', default: '[]' })
  examinerKeywords: ModelAnswerKeyword[];

  @Column('simple-json', { name: 'criteria_scores' })
  criteriaScores: DimensionEvaluation[];

  @Column('simple-json', { name: 'dimension_marks' })
  dimensionMarks: Record<AnswerEvaluationDimension, number>;

  @Column({ type: 'float', name: 'marks_awarded', default: 0 })
  marksAwarded: number;

  @Column({ type: 'float', name: 'max_marks', default: 0 })
  maxMarks: number;

  @Column({ type: 'float', default: 0 })
  percentage: number;

  @Column({ type: 'int', name: 'time_spent_seconds', nullable: true })
  timeSpentSeconds: number | null;

  @Column('simple-json', { default: '[]' })
  strengths: string[];

  @Column('simple-json', { default: '[]' })
  weaknesses: string[];

  @Column('simple-json', { default: '[]' })
  suggestions: string[];

  @Column({ type: 'varchar', default: 'evaluated' })
  status: AnswerEvaluationStatus;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


