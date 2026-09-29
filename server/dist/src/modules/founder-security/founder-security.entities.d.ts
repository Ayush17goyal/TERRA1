export declare const FOUNDER_DEFAULT_EMAIL = "legatrixon2026@gmail.com";
export type FounderSecurityEventType = 'ADMIN_LOGIN_ATTEMPT' | 'ADMIN_LOGIN_SUCCESS' | 'ADMIN_LOGIN_FAILED' | 'NEW_DEVICE_LOGIN' | 'NEW_BROWSER_LOGIN' | 'NEW_IP_LOGIN' | 'PASSWORD_CHANGE' | 'NEW_ADMIN_CREATED' | 'ROLE_CHANGED' | 'ACCOUNT_LOCKED' | 'FOUNDER_PORTAL_ACCESS_ATTEMPT' | 'SUPER_ADMIN_ACCESS_ATTEMPT';
export declare const FOUNDER_SECURITY_EVENTS: FounderSecurityEventType[];
export declare class FounderSecuritySettings {
    id: string;
    primaryEmail: string;
    backupEmails: string[];
    enabledAlerts: Record<FounderSecurityEventType, boolean>;
    approvalWorkflows: {
        newAdminCreation: boolean;
        roleChanges: boolean;
        superAdminAccess: boolean;
        passwordChanges: boolean;
    };
    updatedAt: Date;
}
export declare class FounderSecurityEvent {
    id: string;
    eventType: FounderSecurityEventType;
    title: string;
    message: string;
    actorId: string;
    actorEmail: string;
    ipAddress: string;
    userAgent: string;
    metadata: Record<string, any>;
    recipients: string[];
    deliveryStatus: 'pending' | 'sent' | 'failed' | 'disabled';
    deliveryError: string;
    createdAt: Date;
}
export declare class AdminAccountLock {
    id: string;
    username: string;
    role: string;
    lockedUntil: Date;
    ipAddress: string;
    userAgent: string;
    createdAt: Date;
}
