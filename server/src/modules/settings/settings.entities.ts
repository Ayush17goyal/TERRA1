import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_activity_logs')
export class UserActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  module: string;

  @Column()
  action: string;

  @Column('simple-json', { nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('user_settings_profiles')
export class UserSettingsProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ nullable: true })
  email: string;

  @Column({ name: 'full_name', nullable: true })
  fullName: string;

  @Column({ name: 'profile_photo_url', nullable: true })
  profilePhotoUrl: string;

  @Column({ nullable: true })
  university: string;

  @Column({ name: 'year_of_study', nullable: true })
  yearOfStudy: string;

  @Column({ name: 'learning_goal', nullable: true })
  learningGoal: string;

  @Column({ name: 'ai_provider_onboarding_completed', default: false })
  aiProviderOnboardingCompleted: boolean;

  @Column({ name: 'ai_provider_onboarding_completed_at', type: 'datetime', nullable: true })
  aiProviderOnboardingCompletedAt: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('user_subscriptions')
export class UserSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'plan_name' })
  planName: string;

  @Column({ default: 'inactive' })
  status: string;

  @Column({ name: 'renewal_date', type: 'datetime', nullable: true })
  renewalDate: Date;

  @Column({ name: 'ai_credits_used', default: 0 })
  aiCreditsUsed: number;

  @Column({ name: 'ai_credits_limit', default: 0 })
  aiCreditsLimit: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('user_notification_preferences')
export class UserNotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'email_notifications', default: false })
  emailNotifications: boolean;

  @Column({ name: 'study_reminders', default: false })
  studyReminders: boolean;

  @Column({ name: 'quiz_reminders', default: false })
  quizReminders: boolean;

  @Column({ name: 'revision_alerts', default: false })
  revisionAlerts: boolean;

  @Column({ name: 'weekly_reports', default: false })
  weeklyReports: boolean;

  @Column({ name: 'delivery_email', default: true })
  deliveryEmail: boolean;

  @Column({ name: 'delivery_browser', default: true })
  deliveryBrowser: boolean;

  @Column({ name: 'delivery_mobile', default: false })
  deliveryMobile: boolean;

  @Column({ name: 'delivery_digest', default: false })
  deliveryDigest: boolean;

  @Column({ name: 'browser_push', default: true })
  browserPush: boolean;

  @Column({ name: 'mobile_push', default: false })
  mobilePush: boolean;

  @Column({ name: 'weekly_digest', default: false })
  weeklyDigest: boolean;

  @Column({ name: 'quiet_start', default: '22:00' })
  quietStart: string;

  @Column({ name: 'quiet_end', default: '07:00' })
  quietEnd: string;

  @Column({ name: 'quiet_hours_start', default: '22:00' })
  quietHoursStart: string;

  @Column({ name: 'quiet_hours_end', default: '07:00' })
  quietHoursEnd: string;

  @Column({ name: 'priority', default: 'All Notifications' })
  priority: string;

  @Column({ name: 'notification_priority', default: 'All Notifications' })
  notificationPriority: string;

  @Column({ name: 'fcm_token', nullable: true })
  fcmToken: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('user_achievements')
export class UserAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'badge_key' })
  badgeKey: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlockedAt: Date;
}

@Entity('account_deletion_requests')
export class AccountDeletionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ default: 'requested' })
  status: 'requested' | 'soft_deleted' | 'permanent_delete_pending' | 'completed';

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('user_feedbacks')
export class UserFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  type: 'rating' | 'bug' | 'feature' | 'ai_feedback' | 'ticket';

  @Column({ nullable: true })
  title: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ nullable: true, type: 'int' })
  rating: number;

  @Column({ nullable: true })
  module: string;

  @Column({ name: 'issue_type', nullable: true })
  issueType: string;

  @Column({ name: 'screenshot_url', nullable: true })
  screenshotUrl: string;

  @Column({ nullable: true })
  priority: string;

  @Column({ name: 'is_helpful', nullable: true })
  isHelpful: boolean;

  @Column({ default: 'Submitted' })
  status: 'Submitted' | 'Under Review' | 'Planned' | 'Resolved';

  @Column({ default: 0, type: 'int' })
  votes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('notification_logs')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'notification_type', nullable: true })
  notificationType: string;

  @Column({ name: 'delivery_method', nullable: true })
  deliveryMethod: string;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column()
  status: string;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;

  @Column({ name: 'opened_at', type: 'datetime', nullable: true })
  openedAt: Date;
}
