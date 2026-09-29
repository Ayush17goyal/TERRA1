import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DraftingSessionStatus = 'in_progress' | 'completed';

@Entity('drafting_mentor_sessions')
export class DraftingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'text' })
  topic: string;

  @Column({ name: 'current_lesson_index', default: 0 })
  currentLessonIndex: number;

  @Column('simple-json', { name: 'completed_lessons', default: '[]' })
  completedLessons: number[];

  @Column({ default: 'in_progress' })
  status: DraftingSessionStatus;

  @Column('simple-json', { name: 'academy_state', default: '{}' })
  academyState: Record<string, unknown>;

  @Column({ name: 'state_version', default: 0 })
  stateVersion: number;

  @Column({ name: 'last_activity_at', nullable: true })
  lastActivityAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
