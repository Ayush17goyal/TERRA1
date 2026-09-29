export declare class AiProvider {
    id: string;
    providerKey: string;
    displayName: string;
    enabled: boolean;
    priority: number;
    status: string;
    lastSuccessAt: Date | null;
    lastFailureAt: Date | null;
    lastFailureReason: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare class AiProviderKey {
    id: string;
    providerKey: string;
    label: string;
    encryptedKey: string;
    encryptionIv: string;
    encryptionTag: string;
    fingerprint: string | null;
    status: string;
    priority: number;
    isActive: boolean;
    lastTestedAt: Date | null;
    lastSuccessAt: Date | null;
    lastFailureAt: Date | null;
    lastFailureReason: string | null;
    createdBy: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare class AiProviderFailure {
    id: string;
    providerKey: string;
    keyFingerprint: string | null;
    httpStatus: number | null;
    failureType: string;
    safeMessage: string;
    requestModule: string | null;
    model: string | null;
    createdAt: Date;
}
export declare class AiProviderAlert {
    id: string;
    providerKey: string;
    severity: string;
    alertType: string;
    title: string;
    message: string;
    status: string;
    emailSent: boolean;
    emailSentAt: Date | null;
    acknowledgedBy: string | null;
    acknowledgedAt: Date | null;
    resolvedAt: Date | null;
    createdAt: Date;
}
export declare class AiProviderUsageMetric {
    id: string;
    providerKey: string;
    keyFingerprint: string | null;
    moduleKey: string | null;
    requestCount: number;
    successCount: number;
    failureCount: number;
    rateLimitCount: number;
    quotaFailureCount: number;
    avgLatencyMs: number;
    tokensPrompt: number;
    tokensCompletion: number;
    estimatedCost: number;
    windowStart: Date | null;
    windowEnd: Date | null;
    createdAt: Date;
}
