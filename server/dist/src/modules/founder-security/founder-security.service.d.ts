import { Repository, DataSource } from 'typeorm';
import { FounderSecurityEvent, FounderSecurityEventType, FounderSecuritySettings, AdminAccountLock } from './founder-security.entities';
type FounderSettingsPayload = Partial<{
    primaryEmail: string;
    backupEmails: string[];
    enabledAlerts: Record<FounderSecurityEventType, boolean>;
    approvalWorkflows: FounderSecuritySettings['approvalWorkflows'];
}>;
export declare class FounderSecurityService {
    private readonly settingsRepo;
    private readonly eventRepo;
    private readonly lockRepo;
    private readonly dataSource;
    private readonly logger;
    constructor(settingsRepo: Repository<FounderSecuritySettings>, eventRepo: Repository<FounderSecurityEvent>, lockRepo: Repository<AdminAccountLock>, dataSource: DataSource);
    private getPublicBackendOrigin;
    private buildPublicApiUrl;
    private buildIpApiUrl;
    private loginApprovals;
    pendingLogins: Map<string, {
        adminId: string;
        role: string;
        ipAddress: string;
        userAgent: string;
        createdAt: Date;
        fails: number;
    }>;
    private clerkApprovals;
    private clerkSessions;
    isAccountLocked(username: string, role: string): Promise<{
        locked: boolean;
        lockedUntil?: Date;
    }>;
    clearAllLocks(): Promise<{
        success: boolean;
    }>;
    getFailedSecurityQuestionCount(username: string, role: string): Promise<number>;
    verifySecurityQuestion(sessionToken: string, answer: string): Promise<{
        ok: boolean;
        pendingApproval?: boolean;
        token?: string;
        attemptsRemaining?: number;
        locked?: boolean;
        message?: string;
    }>;
    verifySecret(candidate: string, encodedHash: string): boolean;
    initiateLoginApproval(adminId: string, role: string, ipAddress: string, userAgent: string): Promise<string>;
    getLoginApprovalStatus(token: string): {
        adminId: string;
        role: string;
        status: "pending" | "approved" | "rejected";
        ipAddress: string;
        userAgent: string;
        createdAt: Date;
    };
    approveLogin(token: string): Promise<boolean>;
    rejectLogin(token: string): Promise<boolean>;
    private getLocalIpAddress;
    private getPhysicalIpAddress;
    requestClerkAccess(input: {
        role: string;
        adminId: string;
        answer: string;
        ipAddress: string;
        userAgent: string;
    }): Promise<{
        ok: boolean;
        message: string;
        pendingApproval?: undefined;
        token?: undefined;
    } | {
        ok: boolean;
        pendingApproval: boolean;
        token: string;
        message?: undefined;
    }>;
    approveClerkAccess(token: string): Promise<boolean>;
    rejectClerkAccess(token: string): Promise<boolean>;
    getClerkAccessStatus(token: string): {
        status: "rejected" | "pending" | "approved";
        sessionToken: string;
    };
    checkClerkAccessSession(sessionToken: string): {
        valid: boolean;
        expiresAt?: number;
    };
    sendClerkAccessEmail(token: string, adminId: string, role: string, ipAddress: string, userAgent: string): Promise<void>;
    sendApprovalEmail(token: string, adminId: string, role: string, ipAddress: string, userAgent: string): Promise<void>;
    getSettings(): Promise<FounderSecuritySettings>;
    updateSettings(payload: FounderSettingsPayload): Promise<FounderSecuritySettings>;
    listEvents(limit?: number): Promise<FounderSecurityEvent[]>;
    recordSecurityEvent(input: {
        eventType: FounderSecurityEventType;
        title?: string;
        message?: string;
        actorId?: string;
        actorEmail?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }, options?: {
        waitForDelivery?: boolean;
    }): Promise<FounderSecurityEvent>;
    private defaultSettings;
    private defaultEnabledAlerts;
    private defaultApprovalWorkflows;
    private resolveRecipients;
    private cleanEmail;
    private cleanEmailList;
    private parseUserAgent;
    private sendImmediateEmail;
    private sendSmtp;
    private toHumanLabel;
    private defaultEventMessage;
    getAdminAnalytics(): Promise<{
        usersCount: number;
        eventsCount: number;
        internshipsCount: number;
        researchCount: number;
        mootActivitiesCount: number;
        flashcardsCount: number;
        studyHoursCount: number;
        notificationsCount: number;
    }>;
}
export {};
