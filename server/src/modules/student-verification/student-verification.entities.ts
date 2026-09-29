import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('verification_requests')
export class VerificationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ name: 'university_name' })
  universityName: string;

  @Column()
  course: string;

  @Column({ name: 'year_of_study' })
  yearOfStudy: string;

  @Column({ name: 'student_email' })
  studentEmail: string;

  @Column({ name: 'student_id_number' })
  studentIdNumber: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'verified' | 'rejected';

  @Column({ name: 'is_academic_email', default: false })
  isAcademicEmail: boolean;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('verification_documents')
export class VerificationDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'verification_request_id' })
  verificationRequestId: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'document_type' })
  documentType: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('verification_audit_logs')
export class VerificationAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'verification_request_id' })
  verificationRequestId: string;

  @Column()
  action: string;

  @Column({ name: 'performed_by' })
  performedBy: string;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
