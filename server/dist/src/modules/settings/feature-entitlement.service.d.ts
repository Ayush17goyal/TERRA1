import { DataSource, Repository } from 'typeorm';
import { UserSubscription } from './settings.entities';
import { ApiUsageError, DemoModeAuditLog, DemoModeSetting, FeatureUsageCounter } from './feature-usage.entity';
import { DemoFeature, SubscriptionPlanId } from './subscription-plans';
export type FeatureReservation = {
    counterId: string | null;
    feature: DemoFeature;
    unlimited: boolean;
    mode: 'demo' | 'subscription';
    limit: number | null;
    used: number;
    periodKey: string | null;
};
export type DemoModeConfig = {
    enabled: boolean;
    limitPerFeaturePerDay: number;
    timezone: string;
    updatedAt?: Date;
    updatedBy?: string | null;
};
export declare class FeatureEntitlementService {
    private readonly subscriptions;
    private readonly counters;
    private readonly demoSettings;
    private readonly audits;
    private readonly errors;
    private readonly dataSource;
    private readonly logger;
    constructor(subscriptions: Repository<UserSubscription>, counters: Repository<FeatureUsageCounter>, demoSettings: Repository<DemoModeSetting>, audits: Repository<DemoModeAuditLog>, errors: Repository<ApiUsageError>, dataSource: DataSource);
    getDemoConfig(): Promise<DemoModeConfig>;
    updateDemoConfig(adminId: string, input: {
        enabled?: boolean;
        limitPerFeaturePerDay?: number;
    }): Promise<DemoModeConfig>;
    getUsage(userId: string, feature: DemoFeature): Promise<{
        feature: DemoFeature;
        label: string;
        mode: string;
        used: number;
        limit: number;
        remaining: number;
        reset: string;
        timezone: string;
        plan?: undefined;
    } | {
        feature: DemoFeature;
        label: string;
        mode: string;
        plan: SubscriptionPlanId;
        used: number;
        limit: any;
        remaining: any;
        reset?: undefined;
        timezone?: undefined;
    } | {
        feature: DemoFeature;
        label: string;
        mode: string;
        plan: SubscriptionPlanId;
        used: number;
        limit: number;
        remaining: number;
        reset: import("./subscription-plans").ResetPeriod;
        timezone?: undefined;
    }>;
    reserve(userId: string, feature: DemoFeature): Promise<FeatureReservation>;
    refund(reservation: FeatureReservation | null): Promise<void>;
    recordApiError(userId: string | null, feature: DemoFeature, error: any): Promise<void>;
    getAdminOverview(): Promise<{
        date: string;
        totalUsers: number;
        todayUsage: number;
        activeUsers: number;
        usersReachingLimits: number;
        apiErrorsToday: number;
        topFeatures: {
            feature: string;
            label: string;
            uses: number;
        }[];
        enabled: boolean;
        limitPerFeaturePerDay: number;
        timezone: string;
        updatedAt?: Date;
        updatedBy?: string | null;
    }>;
    private atomicReserve;
    private resolveActivePlan;
    private ensureSubscription;
    private periodKey;
    private calendarDate;
    private startOfIndiaDayUtc;
    private defaultDemoLimit;
    private limitException;
}
