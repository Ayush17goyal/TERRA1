import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('live_drafting_sessions')
export class LiveDraftingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  instructor: string;

  @Column({ name: 'scheduled_at' })
  scheduledAt: Date;

  @Column({ name: 'end_at', nullable: true })
  endAt: Date;

  @Column({ name: 'meet_link', nullable: true })
  meetLink: string;

  @Column({ name: 'course_id', nullable: true })
  courseId: string;

  @Column({ default: 'scheduled' })
  status: string; // 'scheduled' | 'cancelled'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
