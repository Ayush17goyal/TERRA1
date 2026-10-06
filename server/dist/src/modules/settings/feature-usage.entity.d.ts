export declare class FeatureUsageCounter {
    id: string;
    userId: string;
    featureKey: string;
    planKey: string;
    periodKey: string;
    usedCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class DemoModeSetting {
    id: string;
    enabled: boolean;
    limitPerFeaturePerDay: number;
    timezone: string;
    updatedBy: string | null;
    updatedAt: Date;
}
export declare class DemoModeAuditLog {
    id: string;
    adminId: string;
    action: string;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    createdAt: Date;
}
export declare class ApiUsageError {
    id: string;
    userId: string | null;
    featureKey: string;
    errorCode: string | null;
    httpStatus: number | null;
    createdAt: Date;
}
