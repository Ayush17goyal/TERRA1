export declare class AiPlanEntitlement {
    id: string;
    planKey: string;
    moduleKey: string;
    creditLimit: number;
    resetPeriod: string;
    isUnlimited: boolean;
    fairUsageLimit: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class UserAiCreditBalance {
    id: string;
    userId: string;
    moduleKey: string;
    planKey: string;
    creditsGranted: number;
    creditsUsed: number;
    creditsRemaining: number;
    resetPeriod: string;
    resetAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare class AiCreditTransaction {
    id: string;
    userId: string;
    moduleKey: string;
    requestId: string | null;
    transactionType: 'grant' | 'consume' | 'refund' | 'admin_adjustment' | 'limit_reached';
    amount: number;
    source: string;
    providerUsed: string | null;
    cacheStatus: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
}
