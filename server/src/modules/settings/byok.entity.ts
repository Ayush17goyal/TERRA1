import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('user_api_keys')
@Unique(['userId', 'provider'])
export class UserApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  provider: string; // 'openai' | 'gemini' | 'groq'

  @Column({ name: 'api_key_encrypted', type: 'text' })
  apiKeyEncrypted: string;

  @Column({ name: 'encryption_iv' })
  encryptionIv: string;

  @Column({ name: 'encryption_tag' })
  encryptionTag: string;

  @Column({ name: 'key_fingerprint', nullable: true })
  keyFingerprint: string;

  @Column({ default: 'Connected' })
  status: string; // 'Connected' | 'Invalid Key' | 'Rate Limited' | 'Not Configured'

  @Column({ name: 'last_verified_at', type: 'datetime', nullable: true })
  lastVerifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('user_byok_usage_metrics')
@Unique(['userId'])
export class UserByokUsageMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'requests_user_keys', default: 0 })
  requestsUserKeys: number;

  @Column({ name: 'requests_legatrixon_keys', default: 0 })
  requestsLegatrixonKeys: number;

  @Column({ name: 'cache_hits', default: 0 })
  cacheHits: number;

  @Column({ name: 'estimated_api_calls_saved', default: 0 })
  estimatedApiCallsSaved: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
