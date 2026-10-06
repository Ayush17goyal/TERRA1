import { SettingsService } from './settings.service';
import { FeatureEntitlementService } from './feature-entitlement.service';
import { DemoFeature } from './subscription-plans';
export declare class SettingsController {
    private readonly settings;
    private readonly entitlements;
    constructor(settings: SettingsService, entitlements: FeatureEntitlementService);
    getDemoMode(): Promise<import("./feature-entitlement.service").DemoModeConfig>;
    getDemoUsage(req: any, feature: DemoFeature): Promise<{
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
        plan: import("./subscription-plans").SubscriptionPlanId;
        used: number;
        limit: any;
        remaining: any;
        reset?: undefined;
        timezone?: undefined;
    } | {
        feature: DemoFeature;
        label: string;
        mode: string;
        plan: import("./subscription-plans").SubscriptionPlanId;
        used: number;
        limit: number;
        remaining: number;
        reset: import("./subscription-plans").ResetPeriod;
        timezone?: undefined;
    }>;
    getDemoAdminOverview(): Promise<{
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
    updateDemoMode(req: any, body: {
        enabled?: boolean;
        limitPerFeaturePerDay?: number;
    }): Promise<import("./feature-entitlement.service").DemoModeConfig>;
    dashboard(req: any): Promise<any>;
    logActivity(req: any, body: {
        module: string;
        action: string;
        metadata?: Record<string, unknown>;
    }): Promise<import("./settings.entities").UserActivityLog>;
    updateNotifications(req: any, body: any): Promise<import("./settings.entities").UserNotificationPreference>;
    requestAccountDeletion(req: any, body: {
        reason?: string;
    }): Promise<import("./settings.entities").AccountDeletionRequest>;
    softDelete(req: any, body: {
        confirmation?: string;
    }): Promise<import("./settings.entities").AccountDeletionRequest>;
    logoutAllDevices(req: any): Promise<{
        success: boolean;
        provider: string;
        revokedSessions: number;
    }>;
    dataRemovalRequest(req: any): Promise<import("./settings.entities").AccountDeletionRequest>;
    permanentDelete(req: any, body: {
        confirmation?: string;
    }): Promise<{
        success: boolean;
    }>;
    exportData(req: any, res: any, kind: string, format: string): Promise<any>;
    createFeedback(req: any, body: any): Promise<any>;
    getFeedbacks(req: any): Promise<any[]>;
    getCommunityFeatures(): Promise<any[]>;
    voteFeature(req: any, id: string): Promise<any>;
    getAdminFeedbacks(): Promise<any[]>;
    updateFeedbackStatus(id: string, body: {
        status: string;
    }): Promise<any>;
    registerFcmToken(req: any, body: {
        fcmToken: string;
    }): Promise<import("./settings.entities").UserNotificationPreference>;
    upgradeSubscription(req: any, body: {
        planName: string;
    }): Promise<{
        planName: import("./subscription-plans").SubscriptionPlanId;
        status: string;
        renewalDate: Date;
        usagePercentage: number;
        aiCreditsUsed: number;
        remainingCredits: number;
    }>;
    simulatePasswordChange(req: any): Promise<{
        success: boolean;
    }>;
    triggerTestNotification(req: any, body: {
        type: 'email' | 'browser';
    }): Promise<{
        success: boolean;
    }>;
    getProfile(req: any): Promise<any>;
    getAiProviderOnboarding(req: any): Promise<{
        completed: boolean;
        completedAt: Date;
    }>;
    completeAiProviderOnboarding(req: any): Promise<{
        completed: boolean;
        completedAt: Date;
    }>;
    updateProfile(req: any, body: any): Promise<any>;
    login(req: any, body: {
        email: string;
    }): Promise<{
        success: boolean;
    }>;
    logout(req: any): Promise<{
        success: boolean;
    }>;
}
