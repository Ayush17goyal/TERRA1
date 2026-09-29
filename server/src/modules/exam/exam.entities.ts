import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';

@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'clerk_user_id', nullable: true })
  clerkUserId: string;

  @Column({ name: 'full_name', nullable: true })
  fullName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ name: 'subject_name', nullable: true })
  subjectName: string;

  @Column()
  subject: string;

  @Column({ name: 'exam_date', type: 'datetime' })
  examDate: Date;

  @Column({ name: 'exam_time', type: 'varchar', length: 20, nullable: true })
  examTime: string;

  @Column({ name: 'prep_level' })
  prepLevel: 'Beginner' | 'Intermediate' | 'Expert';

  @Column({ name: 'syllabus_completion', default: 0 })
  syllabusCompletion: number;

  @Column({ name: 'email_reminder_enabled', default: false })
  emailReminderEnabled: boolean;

  @Column({ name: 'email_reminder_minutes', default: 1440 })
  emailReminderMinutes: number;

  @Column({ name: 'reminder_type', nullable: true })
  reminderType: string;

  @Column({ name: 'reminder_enabled', default: true })
  reminderEnabled: boolean;

  @Column({ name: 'reminder_trigger_at', type: 'datetime', nullable: true })
  reminderTriggerAt: Date;

  @Column({ name: 'reminder_sent_at', type: 'datetime', nullable: true })
  reminderSentAt: Date;

  @Column({ default: 'Asia/Kolkata' })
  timezone: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('roadmaps')
export class Roadmap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_id', type: 'uuid', unique: true })
  examId: string;

  @Column('simple-json', { default: '{}' })
  data: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => Exam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: Exam;
}

@Entity('revision_plans')
export class RevisionPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_id', type: 'uuid', unique: true })
  examId: string;

  @Column('simple-json', { default: '{}' })
  data: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => Exam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: Exam;
}

@Entity('mock_tests')
export class MockTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @Column()
  subject: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  score: number;

  @Column({ name: 'total_questions', default: 20 })
  totalQuestions: number;

  @Column({ type: 'datetime' })
  date: Date;

  @Column('simple-json', { name: 'weak_subjects', default: '[]' })
  weakSubjects: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Exam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: Exam;
}

@Entity('calendar_events')
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'exam_id', type: 'uuid', nullable: true })
  examId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'event_date', type: 'date' })
  eventDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string;

  @Column({ name: 'event_time', type: 'time' })
  eventTime: string;

  @Column()
  subject: string;

  @Column({ name: 'event_type' })
  eventType: 'class' | 'assignment' | 'moot' | 'internship' | 'exam' | 'study' | 'research' | 'revision';

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string;

  @Column({ type: 'varchar', length: 20, default: 'Medium' })
  priority: string;

  @Column({ name: 'module_source', type: 'varchar', length: 100, nullable: true })
  moduleSource: string;

  @Column({ name: 'google_event_id', nullable: true })
  googleEventId: string;

  @Column({ name: 'is_synced', default: false })
  isSynced: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'exam_id', type: 'uuid', nullable: true })
  examId: string;

  @Column({ name: 'clerk_user_id', nullable: true })
  clerkUserId: string;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ default: 'alert' })
  type: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'email_sent', type: 'boolean', default: false })
  emailSent: boolean;

  @Column({ name: 'delivery_channel', default: 'all' })
  deliveryChannel: string;

  @Column({ default: 'normal' })
  priority: string;

  @Column({ name: 'trigger_time', type: 'datetime' })
  triggerTime: Date;

  @Column({ name: 'email_subject', nullable: true })
  emailSubject: string;

  @Column({ name: 'email_body', type: 'text', nullable: true })
  emailBody: string;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt: Date;

  @Column({ name: 'failed_at', type: 'datetime', nullable: true })
  failedAt: Date;

  @Column({ name: 'delivery_error', type: 'text', nullable: true })
  deliveryError: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('readiness_snapshots')
export class ReadinessSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @Column({ name: 'syllabus_completion' })
  syllabusCompletion: number;

  @Column({ name: 'mock_scores_avg', type: 'numeric' })
  mockScoresAvg: number;

  @Column({ name: 'study_hours_total', type: 'numeric' })
  studyHoursTotal: number;

  @Column({ name: 'revision_progress' })
  revisionProgress: number;

  @Column({ name: 'habit_compliance' })
  habitCompliance: number;

  @Column({ name: 'readiness_score' })
  readinessScore: number;

  @Column({ name: 'expected_7_days' })
  expected7Days: number;

  @Column({ name: 'expected_14_days' })
  expected14Days: number;

  @Column({ name: 'expected_30_days' })
  expected30Days: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('google_oauth_tokens')
export class GoogleOAuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'google_access_token' })
  googleAccessToken: string;

  @Column({ name: 'google_refresh_token', nullable: true })
  googleRefreshToken: string;

  @Column({ name: 'token_expiry', type: 'datetime', nullable: true })
  tokenExpiry: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('recommendations')
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  content: string;

  @Column({ name: 'target_date', type: 'date' })
  targetDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
