import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import {
  MockTestAssemblySection,
  MockTestCoverageSnapshot,
  MockTestMode,
  MockTestSpecification,
  MockTestStatus,
} from '../mock-test-engine.types';

@Entity('mock_test_papers')
@Index(['userId', 'createdAt'])
@Index(['userId', 'mode', 'createdAt'])
export class MockTestPaperEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar' })
  mode: MockTestMode;

  @Column({ type: 'text' })
  prompt: string;

  @Column('simple-json')
  specification: MockTestSpecification;

  @Column('simple-json', { name: 'coverage_snapshot', default: '{}' })
  coverageSnapshot: MockTestCoverageSnapshot;

  @Column('simple-json', { name: 'assembly_sections', default: '[]' })
  assemblySections: MockTestAssemblySection[];

  @Column('simple-array', { name: 'question_ids', nullable: true })
  questionIds: string[];

  @Column({ type: 'int', name: 'total_marks', default: 0 })
  totalMarks: number;

  @Column({ type: 'int', name: 'duration_minutes', default: 0 })
  durationMinutes: number;

  @Column({ type: 'varchar', default: 'ready' })
  status: MockTestStatus;

  @Column('simple-array', { nullable: true })
  shortfalls: string[];

  @Column({ type: 'text', name: 'pdf_base64' })
  pdfBase64: string;

  @Column({ type: 'int', name: 'generation_time_ms', default: 0 })
  generationTimeMs: number;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
