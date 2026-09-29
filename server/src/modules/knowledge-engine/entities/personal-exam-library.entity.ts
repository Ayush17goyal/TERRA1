import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { KnowledgeLibraryStage, LibraryStatus } from '../knowledge-engine.types';

@Entity('personal_exam_libraries')
@Index(['userId'], { unique: true })
export class PersonalExamLibraryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', default: 'building' })
  status: LibraryStatus;

  @Column({ type: 'varchar', name: 'current_stage', nullable: true })
  currentStage: KnowledgeLibraryStage | null;

  @Column({ type: 'int', name: 'topics_count', default: 0 })
  topicsCount: number;

  @Column({ type: 'int', name: 'subtopics_count', default: 0 })
  subtopicsCount: number;

  @Column({ type: 'int', name: 'definitions_count', default: 0 })
  definitionsCount: number;

  @Column({ type: 'int', name: 'cases_count', default: 0 })
  casesCount: number;

  @Column({ type: 'int', name: 'illustrations_count', default: 0 })
  illustrationsCount: number;

  @Column({ type: 'float', name: 'coverage_score', default: 0 })
  coverageScore: number;

  @Column({ type: 'float', name: 'confidence_score', default: 0 })
  confidenceScore: number;

  @Column('simple-array', { name: 'review_reasons', nullable: true })
  reviewReasons: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
