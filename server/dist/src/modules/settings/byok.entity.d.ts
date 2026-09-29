export declare class UserApiKey {
    id: string;
    userId: string;
    provider: string;
    apiKeyEncrypted: string;
    encryptionIv: string;
    encryptionTag: string;
    keyFingerprint: string;
    status: string;
    lastVerifiedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare class UserByokUsageMetric {
    id: string;
    userId: string;
    requestsUserKeys: number;
    requestsLegatrixonKeys: number;
    cacheHits: number;
    estimatedApiCallsSaved: number;
    createdAt: Date;
    updatedAt: Date;
}
