import { PaymentService } from './payment.service';
export declare class PaymentController {
    private readonly paymentService;
    constructor(paymentService: PaymentService);
    createOrder(req: any, body: {
        plan_id: string;
        amount: number;
    }): Promise<{
        order_id: any;
        amount: any;
        currency: any;
        key_id: string;
    }>;
    verifyPayment(req: any, body: {
        payment_id: string;
        order_id: string;
        signature: string;
        plan_id: string;
    }): Promise<{
        success: boolean;
        invoice_number: string;
        payment_id: string;
        order_id: string;
    }>;
    getHistory(req: any): Promise<import("./payment.entity").Payment[]>;
}
