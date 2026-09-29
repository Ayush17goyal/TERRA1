import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PlannedQuestionType, QuestionMarkValue } from '../question-planning.types';

@Entity('question_slots')
@Index(['userId', 'tkuId', 'questionType', 'markValue'])
@Index(['planId'])
export class QuestionSlotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'tku_id' })
  tkuId: string;

  @Column()
  topic: string;

  @Column()
  subtopic: string;

  @Column({ type: 'varchar', name: 'question_type' })
  questionType: PlannedQuestionType;

  @Column({ type: 'int', name: 'mark_value' })
  markValue: QuestionMarkValue;

  @Column({ type: 'int', name: 'slot_index' })
  slotIndex: number;

  @Column({ type: 'float', name: 'eligibility_score', default: 0 })
  eligibilityScore: number;

  @Column('simple-json', { name: 'required_entity_refs', default: '[]' })
  requiredEntityRefs: string[];

  @Column('simple-json', { name: 'requirements', default: '{}' })
  requirements: Record<string, any>;

  @Column({ type: 'varchar', default: 'planned' })
  status: 'planned';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
