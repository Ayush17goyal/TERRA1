export declare class Payment {
    id: string;
    userId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    planId: string;
    amount: number;
    currency: string;
    status: string;
    method: string;
    invoiceNumber: string;
    errorDescription: string;
    createdAt: Date;
    updatedAt: Date;
}
