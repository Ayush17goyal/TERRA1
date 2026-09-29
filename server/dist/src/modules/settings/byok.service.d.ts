import { Repository } from 'typeorm';
import { UserApiKey, UserByokUsageMetric } from './byok.entity';
declare const SUPPORTED_PROVIDERS: readonly ["openai", "gemini", "groq"];
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];
type ProviderStatus = 'Connected' | 'Invalid Key' | 'Rate Limited' | 'Not Configured';
export declare class ByokService {
    private readonly apiKeyRepo;
    private readonly usageRepo;
    private readonly logger;
    private readonly algorithm;
    constructor(apiKeyRepo: Repository<UserApiKey>, usageRepo: Repository<UserByokUsageMetric>);
    private getEncryptionKey;
    private encrypt;
    private decrypt;
    private isSupportedProvider;
    private fingerprint;
    sanitizeError(error: any): string;
    classifyProviderError(error: any): ProviderStatus;
    private validateKeyWithProvider;
    saveKey(userId: string, provider: string, apiKey: string): Promise<{
        provider: string;
        status: string;
        lastVerifiedAt: Date | null;
        fingerprint: string;
    }>;
    deleteKey(userId: string, provider: string): Promise<{
        deleted: boolean;
    }>;
    listKeys(userId: string): Promise<Array<{
        provider: string;
        status: string;
        lastVerifiedAt: Date | null;
        fingerprint: string | null;
    }>>;
    getDecryptedKey(userId: string, provider: SupportedProvider): Promise<string | null>;
    getAnyDecryptedKey(userId: string): Promise<{
        apiKey: string;
        provider: SupportedProvider;
        baseURL?: string;
        model: string;
    } | null>;
    updateProviderStatus(userId: string, provider: string, status: ProviderStatus): Promise<void>;
    trackUsage(userId: string, usedUserKey: boolean): Promise<void>;
    incrementCacheHit(userId: string): Promise<void>;
    getUsageMetrics(userId: string): Promise<{
        requestsUserKeys: number;
        requestsLegatrixonKeys: number;
        cacheHits: number;
        estimatedApiCallsSaved: number;
    }>;
}
export {};
