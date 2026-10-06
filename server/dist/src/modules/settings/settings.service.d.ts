import { DataSource, Repository } from 'typeorm';
import { CalendarEvent, Exam, MockTest, ReadinessSnapshot } from '../exam/exam.entities';
import { NotebookDocument } from '../notebook/notebook.entity';
import { ResearchAsset, ResearchDocument, ResearchNote, ResearchQuery, ResearchReport, ResearchSource, ResearchUser, SavedReport } from '../research/research.entities';
import { ClerkAccountService } from './clerk-account.service';
import { NotificationService } from '../exam/notification.service';
import { SupabaseService } from './supabase.service';
import { CreditService } from './credit.service';
import { AccountDeletionRequest, UserAchievement, UserActivityLog, UserNotificationPreference, UserSettingsProfile, UserSubscription, UserFeedback } from './settings.entities';
type ActivityInput = {
    userId: string;
    module: string;
    action: string;
    metadata?: Record<string, unknown>;
};
type AuthUser = {
    id: string;
    email?: string;
    fullName?: string;
    imageUrl?: string;
    university?: string;
    yearOfStudy?: string;
    learningGoal?: string;
    createdAt?: number | Date;
};
export declare class SettingsService {
    private readonly activityRepo;
    private readonly profileRepo;
    private readonly subscriptionRepo;
    private readonly notificationRepo;
    private readonly achievementRepo;
    private readonly deletionRepo;
    private readonly examRepo;
    private readonly mockRepo;
    private readonly calendarRepo;
    private readonly readinessRepo;
    private readonly notebookRepo;
    private readonly researchUserRepo;
    private readonly researchQueryRepo;
    private readonly researchReportRepo;
    private readonly researchSourceRepo;
    private readonly researchNoteRepo;
    private readonly savedReportRepo;
    private readonly researchAssetRepo;
    private readonly researchDocumentRepo;
    private readonly feedbackRepo;
    private readonly clerkAccounts;
    private readonly notificationService;
    private readonly supabaseService;
    private readonly creditService;
    private readonly dataSource;
    private readonly logger;
    private dashboardCache;
    constructor(activityRepo: Repository<UserActivityLog>, profileRepo: Repository<UserSettingsProfile>, subscriptionRepo: Repository<UserSubscription>, notificationRepo: Repository<UserNotificationPreference>, achievementRepo: Repository<UserAchievement>, deletionRepo: Repository<AccountDeletionRequest>, examRepo: Repository<Exam>, mockRepo: Repository<MockTest>, calendarRepo: Repository<CalendarEvent>, readinessRepo: Repository<ReadinessSnapshot>, notebookRepo: Repository<NotebookDocument>, researchUserRepo: Repository<ResearchUser>, researchQueryRepo: Repository<ResearchQuery>, researchReportRepo: Repository<ResearchReport>, researchSourceRepo: Repository<ResearchSource>, researchNoteRepo: Repository<ResearchNote>, savedReportRepo: Repository<SavedReport>, researchAssetRepo: Repository<ResearchAsset>, researchDocumentRepo: Repository<ResearchDocument>, feedbackRepo: Repository<UserFeedback>, clerkAccounts: ClerkAccountService, notificationService: NotificationService, supabaseService: SupabaseService, creditService: CreditService, dataSource: DataSource);
    log(input: ActivityInput): Promise<UserActivityLog>;
    getDashboard(authUser: AuthUser): Promise<any>;
    syncAchievementsFromSupabase(userId: string, metrics: Record<string, number>): Promise<{
        id: any;
        userId: any;
        badgeKey: any;
        title: any;
        description: any;
        unlockedAt: any;
    }[]>;
    updateNotificationPreferences(userId: string, payload: Partial<UserNotificationPreference> & any): Promise<UserNotificationPreference>;
    upgradeSubscription(userId: string, planName: string): Promise<{
        planName: import("./subscription-plans").SubscriptionPlanId;
        status: string;
        renewalDate: Date;
        usagePercentage: number;
        aiCreditsUsed: number;
        remainingCredits: number;
    }>;
    simulatePasswordChange(userId: string): Promise<{
        success: boolean;
    }>;
    updateFcmToken(userId: string, fcmToken: string): Promise<UserNotificationPreference>;
    getProfile(clerkUserId: string): Promise<any>;
    getAiProviderOnboarding(authUser: AuthUser): Promise<{
        completed: boolean;
        completedAt: Date;
    }>;
    completeAiProviderOnboarding(authUser: AuthUser): Promise<{
        completed: boolean;
        completedAt: Date;
    }>;
    updateProfile(clerkUserId: string, profileData: any): Promise<any>;
    private parseUserAgent;
    recordLogin(clerkUserId: string, email: string, req: any): Promise<{
        success: boolean;
    }>;
    recordLogout(clerkUserId: string): Promise<{
        success: boolean;
    }>;
    triggerTestNotification(userId: string, type: 'email' | 'browser'): Promise<{
        success: boolean;
    }>;
    requestDeletion(userId: string, reason?: string): Promise<AccountDeletionRequest>;
    softDelete(userId: string, confirmation?: string): Promise<AccountDeletionRequest>;
    requestDataRemoval(userId: string): Promise<AccountDeletionRequest>;
    logoutAllDevices(userId: string): Promise<{
        success: boolean;
        provider: string;
        revokedSessions: number;
    }>;
    permanentlyDelete(userId: string, confirmation?: string): Promise<{
        success: boolean;
    }>;
    exportData(authUser: AuthUser, kind: string, format: string): Promise<{
        filename: string;
        contentType: string;
        buffer: Buffer<ArrayBufferLike>;
    }>;
    private resolveProfile;
    private resolveSubscription;
    private deterministicUuid;
    private findResearchUser;
    private getNotificationPreferences;
    private countResearchCaseSources;
    private getMockTestsForExams;
    private getReadinessForExams;
    private aggregateStudyForge;
    private countActivities;
    private buildFeatureUsage;
    private calculateMasteryScore;
    private calculateStreak;
    private syncAchievements;
    private hasCompletedConstitutionPath;
    private formatSubscription;
    private calculateEngagementScore;
    private calculateFeatureAdoption;
    private pickUsageFeature;
    private calculateLearningVelocity;
    private countSince;
    private metadataNumbers;
    private sumMetadata;
    private average;
    private dateKey;
    private getSecurity;
    private buildExportPayload;
    private renderExportText;
    private createPdfDocument;
    private createDocxDocument;
    private createPptxDocument;
    createFeedback(clerkUserId: string, data: any): Promise<any>;
    getFeedbacks(clerkUserId: string): Promise<any[]>;
    getCommunityFeatures(): Promise<any[]>;
    voteFeature(clerkUserId: string, feedbackId: string): Promise<any>;
    getAdminFeedbacks(): Promise<any[]>;
    updateFeedbackStatus(id: string, status: any): Promise<any>;
}
export {};
