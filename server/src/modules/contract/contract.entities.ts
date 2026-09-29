import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('contract_configs')
export class ContractConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contract_version', default: '1.0.0' })
  contractVersion: string;

  @Column('text', { name: 'contract_content' })
  contractContent: string;

  @UpdateDateColumn({ name: 'last_updated' })
  lastUpdated: Date;
}

@Entity('contract_acceptances')
export class ContractAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ nullable: true })
  email: string;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'browser_user_agent', nullable: true })
  browserUserAgent: string;

  @Column({ name: 'contract_version' })
  contractVersion: string;

  @Column({ default: true })
  accepted: boolean;
}
