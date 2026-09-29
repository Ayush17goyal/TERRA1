import { Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { UserSubscription } from '../settings/settings.entities';
export declare class PaymentService {
    private readonly paymentRepo;
    private readonly subscriptionRepo;
    private readonly logger;
    private readonly razorpayKeyId;
    private readonly razorpayKeySecret;
    constructor(paymentRepo: Repository<Payment>, subscriptionRepo: Repository<UserSubscription>);
    createOrder(userId: string, planId: string, amount: number): Promise<{
        order_id: any;
        amount: any;
        currency: any;
        key_id: string;
    }>;
    verifyPayment(userId: string, paymentId: string, orderId: string, signature: string, planId: string): Promise<{
        success: boolean;
        invoice_number: string;
        payment_id: string;
        order_id: string;
    }>;
    private activateSubscription;
    getPaymentHistory(userId: string): Promise<Payment[]>;
}
