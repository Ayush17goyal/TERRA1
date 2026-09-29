import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const FOUNDER_DEFAULT_EMAIL = 'legatrixon2026@gmail.com';

export type FounderSecurityEventType =
  | 'ADMIN_LOGIN_ATTEMPT'
  | 'ADMIN_LOGIN_SUCCESS'
  | 'ADMIN_LOGIN_FAILED'
  | 'NEW_DEVICE_LOGIN'
  | 'NEW_BROWSER_LOGIN'
  | 'NEW_IP_LOGIN'
  | 'PASSWORD_CHANGE'
  | 'NEW_ADMIN_CREATED'
  | 'ROLE_CHANGED'
  | 'ACCOUNT_LOCKED'
  | 'FOUNDER_PORTAL_ACCESS_ATTEMPT'
  | 'SUPER_ADMIN_ACCESS_ATTEMPT';

export const FOUNDER_SECURITY_EVENTS: FounderSecurityEventType[] = [
  'ADMIN_LOGIN_ATTEMPT',
  'ADMIN_LOGIN_SUCCESS',
  'ADMIN_LOGIN_FAILED',
  'NEW_DEVICE_LOGIN',
  'NEW_BROWSER_LOGIN',
  'NEW_IP_LOGIN',
  'PASSWORD_CHANGE',
  'NEW_ADMIN_CREATED',
  'ROLE_CHANGED',
  'ACCOUNT_LOCKED',
  'FOUNDER_PORTAL_ACCESS_ATTEMPT',
  'SUPER_ADMIN_ACCESS_ATTEMPT',
];

@Entity('founder_security_settings')
export class FounderSecuritySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: FOUNDER_DEFAULT_EMAIL })
  primaryEmail: string;

  @Column('simple-json', { default: '[]' })
  backupEmails: string[];

  @Column('simple-json')
  enabledAlerts: Record<FounderSecurityEventType, boolean>;

  @Column('simple-json', { nullable: true })
  approvalWorkflows: {
    newAdminCreation: boolean;
    roleChanges: boolean;
    superAdminAccess: boolean;
    passwordChanges: boolean;
  };

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('founder_security_events')
export class FounderSecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventType: FounderSecurityEventType;

  @Column({ default: 'Security event' })
  title: string;

  @Column('text')
  message: string;

  @Column({ nullable: true })
  actorId: string;

  @Column({ nullable: true })
  actorEmail: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column('simple-json', { nullable: true })
  metadata: Record<string, any>;

  @Column('simple-json')
  recipients: string[];

  @Column({ default: 'pending' })
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'disabled';

  @Column('text', { nullable: true })
  deliveryError: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('admin_account_locks')
export class AdminAccountLock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  username: string;

  @Column()
  role: string;

  @Column()
  lockedUntil: Date;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}
