export declare class ClerkAccountService {
    private get client();
    getSecurity(userId: string): Promise<{
        clerkConnected: boolean;
        activeSessionsAvailable: boolean;
        activeSessions: number;
        deviceHistoryAvailable: boolean;
        deviceHistory: {
            sessionId: any;
            device: string;
            location: string;
            lastSeen: any;
        }[];
        passwordStatus: string;
        twoFactorStatus: string;
    }>;
    revokeAllSessions(userId: string): Promise<number>;
    deleteUser(userId: string): Promise<void>;
    getUser(userId: string): Promise<import("@clerk/backend").User>;
    updateClerkUser(userId: string, data: {
        fullName?: string;
        phoneNumber?: string;
        university?: string;
        yearOfStudy?: string;
    }): Promise<import("@clerk/backend").User>;
}
