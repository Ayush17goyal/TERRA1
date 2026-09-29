import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('ai_providers')
@Unique(['providerKey'])
export class AiProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_key' })
  providerKey: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: 100 })
  priority: number;

  @Column({ default: 'healthy' })
  status: string;

  @Column({ name: 'last_success_at', type: 'datetime', nullable: true })
  lastSuccessAt: Date | null;

  @Column({ name: 'last_failure_at', type: 'datetime', nullable: true })
  lastFailureAt: Date | null;

  @Column({ name: 'last_failure_reason', type: 'text', nullable: true })
  lastFailureReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('ai_provider_keys')
export class AiProviderKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_key' })
  providerKey: string;

  @Column()
  label: string;

  @Column({ name: 'encrypted_key', type: 'text' })
  encryptedKey: string;

  @Column({ name: 'encryption_iv' })
  encryptionIv: string;

  @Column({ name: 'encryption_tag' })
  encryptionTag: string;

  @Column({ nullable: true })
  fingerprint: string | null;

  @Column({ default: 'backup' })
  status: string;

  @Column({ default: 100 })
  priority: number;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @Column({ name: 'last_tested_at', type: 'datetime', nullable: true })
  lastTestedAt: Date | null;

  @Column({ name: 'last_success_at', type: 'datetime', nullable: true })
  lastSuccessAt: Date | null;

  @Column({ name: 'last_failure_at', type: 'datetime', nullable: true })
  lastFailureAt: Date | null;

  @Column({ name: 'last_failure_reason', type: 'text', nullable: true })
  lastFailureReason: string | null;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('ai_provider_failures')
export class AiProviderFailure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_key' })
  providerKey: string;

  @Column({ name: 'key_fingerprint', nullable: true })
  keyFingerprint: string | null;

  @Column({ name: 'http_status', type: 'int', nullable: true })
  httpStatus: number | null;

  @Column({ name: 'failure_type' })
  failureType: string;

  @Column({ name: 'safe_message', type: 'text' })
  safeMessage: string;

  @Column({ name: 'request_module', nullable: true })
  requestModule: string | null;

  @Column({ nullable: true })
  model: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('ai_provider_alerts')
export class AiProviderAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_key' })
  providerKey: string;

  @Column({ default: 'warning' })
  severity: string;

  @Column({ name: 'alert_type' })
  alertType: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: 'open' })
  status: string;

  @Column({ name: 'email_sent', default: false })
  emailSent: boolean;

  @Column({ name: 'email_sent_at', type: 'datetime', nullable: true })
  emailSentAt: Date | null;

  @Column({ name: 'acknowledged_by', nullable: true })
  acknowledgedBy: string | null;

  @Column({ name: 'acknowledged_at', type: 'datetime', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('ai_provider_usage_metrics')
export class AiProviderUsageMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_key' })
  providerKey: string;

  @Column({ name: 'key_fingerprint', nullable: true })
  keyFingerprint: string | null;

  @Column({ name: 'module_key', nullable: true })
  moduleKey: string | null;

  @Column({ name: 'request_count', default: 0 })
  requestCount: number;

  @Column({ name: 'success_count', default: 0 })
  successCount: number;

  @Column({ name: 'failure_count', default: 0 })
  failureCount: number;

  @Column({ name: 'rate_limit_count', default: 0 })
  rateLimitCount: number;

  @Column({ name: 'quota_failure_count', default: 0 })
  quotaFailureCount: number;

  @Column({ name: 'avg_latency_ms', default: 0 })
  avgLatencyMs: number;

  @Column({ name: 'tokens_prompt', default: 0 })
  tokensPrompt: number;

  @Column({ name: 'tokens_completion', default: 0 })
  tokensCompletion: number;

  @Column({ name: 'estimated_cost', type: 'float', default: 0 })
  estimatedCost: number;

  @Column({ name: 'window_start', type: 'datetime', nullable: true })
  windowStart: Date | null;

  @Column({ name: 'window_end', type: 'datetime', nullable: true })
  windowEnd: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
