import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('ai_plan_entitlements')
@Unique(['planKey', 'moduleKey'])
export class AiPlanEntitlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_key' })
  planKey: string;

  @Column({ name: 'module_key' })
  moduleKey: string;

  @Column({ name: 'credit_limit', default: 0 })
  creditLimit: number;

  @Column({ name: 'reset_period', default: 'lifetime' })
  resetPeriod: string;

  @Column({ name: 'is_unlimited', default: false })
  isUnlimited: boolean;

  @Column({ name: 'fair_usage_limit', default: 0 })
  fairUsageLimit: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('user_ai_credit_balances')
@Unique(['userId', 'moduleKey'])
export class UserAiCreditBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'module_key' })
  moduleKey: string;

  @Column({ name: 'plan_key', default: 'free' })
  planKey: string;

  @Column({ name: 'credits_granted', default: 0 })
  creditsGranted: number;

  @Column({ name: 'credits_used', default: 0 })
  creditsUsed: number;

  @Column({ name: 'credits_remaining', default: 0 })
  creditsRemaining: number;

  @Column({ name: 'reset_period', default: 'lifetime' })
  resetPeriod: string;

  @Column({ name: 'reset_at', type: 'datetime', nullable: true })
  resetAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('ai_credit_transactions')
export class AiCreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'module_key' })
  moduleKey: string;

  @Column({ name: 'request_id', nullable: true })
  requestId: string | null;

  @Column({ name: 'transaction_type' })
  transactionType: 'grant' | 'consume' | 'refund' | 'admin_adjustment' | 'limit_reached';

  @Column({ default: 0 })
  amount: number;

  @Column({ default: 'free_plan' })
  source: string;

  @Column({ name: 'provider_used', nullable: true })
  providerUsed: string | null;

  @Column({ name: 'cache_status', nullable: true })
  cacheStatus: string | null;

  @Column('simple-json', { nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
