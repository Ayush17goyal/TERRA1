import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PlannedQuestionType, QuestionMarkValue } from '../../question-planning/question-planning.types';
import { QuestionDifficulty } from '../../question-bank/question-bank.types';

@Entity('mock_test_paper_questions')
@Index(['paperId', 'questionNumber'], { unique: true })
@Index(['userId', 'questionId'])
export class MockTestPaperQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'paper_id' })
  paperId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'question_id' })
  questionId: string;

  @Column({ type: 'int', name: 'question_number' })
  questionNumber: number;

  @Column({ name: 'section_label' })
  sectionLabel: string;

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

  @Column({ type: 'float', name: 'quality_score', default: 0 })
  qualityScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
