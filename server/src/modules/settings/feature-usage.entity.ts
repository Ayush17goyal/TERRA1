import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('feature_usage_counters')
@Unique(['userId', 'featureKey', 'periodKey'])
export class FeatureUsageCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'feature_key' })
  featureKey: string;

  @Column({ name: 'plan_key' })
  planKey: string;

  @Column({ name: 'period_key' })
  periodKey: string;

  @Column({ name: 'used_count', default: 0 })
  usedCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('demo_mode_settings')
export class DemoModeSetting {
  @PrimaryColumn({ type: 'varchar', default: 'global' })
  id: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'limit_per_feature_per_day', default: 4 })
  limitPerFeaturePerDay: number;

  @Column({ default: 'Asia/Kolkata' })
  timezone: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('demo_mode_audit_logs')
export class DemoModeAuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'admin_id' }) adminId: string;
  @Column() action: string;
  @Column({ name: 'old_value', type: 'simple-json' }) oldValue: Record<string, unknown>;
  @Column({ name: 'new_value', type: 'simple-json' }) newValue: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('api_usage_errors')
export class ApiUsageError {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', nullable: true }) userId: string | null;
  @Column({ name: 'feature_key' }) featureKey: string;
  @Column({ name: 'error_code', nullable: true }) errorCode: string | null;
  @Column({ name: 'http_status', nullable: true }) httpStatus: number | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
