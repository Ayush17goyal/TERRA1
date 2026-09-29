import { HttpException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AiCreditTransaction, AiPlanEntitlement, UserAiCreditBalance } from './credit.entity';
export type AiCreditModuleKey = 'lexmentor' | 'legal_research' | 'memorial_architect' | 'judgment_mastery' | 'lexnotebook' | 'smart_study_forge' | 'bench_simulator';
export declare const FREE_PLAN_CREDITS: Record<AiCreditModuleKey, {
    label: string;
    credits: number;
}>;
export type AiAccessReservation = {
    route: 'system';
    moduleKey: AiCreditModuleKey;
    transactionId: string | null;
    unlimited: boolean;
} | {
    route: 'byok';
    moduleKey: AiCreditModuleKey;
    reason: 'credits_exhausted';
};
export declare class CreditService {
    private readonly entitlementRepo;
    private readonly balanceRepo;
    private readonly transactionRepo;
    private readonly logger;
    constructor(entitlementRepo: Repository<AiPlanEntitlement>, balanceRepo: Repository<UserAiCreditBalance>, transactionRepo: Repository<AiCreditTransaction>);
    normalizeModule(moduleName?: string): AiCreditModuleKey;
    ensureFreeCredits(userId: string): Promise<UserAiCreditBalance[]>;
    getCreditSummary(userId: string): Promise<{
        moduleKey: string;
        label: string;
        planKey: string;
        creditsGranted: number;
        creditsUsed: number;
        creditsRemaining: number;
        resetPeriod: string;
        resetAt: Date;
    }[]>;
    reserveForSystemProvider(userId: string | undefined, moduleName?: string): Promise<AiAccessReservation>;
    refundReservation(userId: string | undefined, reservation: AiAccessReservation | null, reason: string): Promise<void>;
    createLimitReachedException(moduleKey: AiCreditModuleKey): HttpException;
    private ensureFreeEntitlements;
    private recordLimitReached;
    private getSortIndex;
}
