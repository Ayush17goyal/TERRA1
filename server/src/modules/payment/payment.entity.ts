import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'razorpay_order_id', nullable: true })
  razorpayOrderId: string;

  @Column({ name: 'razorpay_payment_id', nullable: true })
  razorpayPaymentId: string;

  @Column({ name: 'razorpay_signature', nullable: true })
  razorpaySignature: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ default: 'INR' })
  currency: string;

  @Column({ default: 'created' })
  status: string;

  @Column({ nullable: true })
  method: string;

  @Column({ name: 'invoice_number', nullable: true })
  invoiceNumber: string;

  @Column({ name: 'error_description', nullable: true, type: 'text' })
  errorDescription: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
