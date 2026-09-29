import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import {
  CoverageMatrixRow,
  MarkDistributionEntry,
  QuestionPlanSummary,
  QuestionRequirement,
  TypeDistributionEntry,
} from '../question-planning.types';

@Entity('question_plans')
@Index(['userId'], { unique: true })
export class QuestionPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', default: 'ready' })
  status: 'ready' | 'empty' | 'stale';

  @Column('simple-json', { name: 'coverage_matrix', default: '[]' })
  coverageMatrix: CoverageMatrixRow[];

  @Column('simple-json', { name: 'mark_distribution', default: '[]' })
  markDistribution: MarkDistributionEntry[];

  @Column('simple-json', { name: 'type_distribution', default: '[]' })
  typeDistribution: TypeDistributionEntry[];

  @Column('simple-json', { name: 'question_requirements', default: '[]' })
  questionRequirements: QuestionRequirement[];

  @Column('simple-json', { default: '{}' })
  summary: QuestionPlanSummary;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
