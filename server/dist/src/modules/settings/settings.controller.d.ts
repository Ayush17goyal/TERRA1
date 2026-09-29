import { SettingsService } from './settings.service';
export declare class SettingsController {
    private readonly settings;
    constructor(settings: SettingsService);
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
        planName: string;
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
