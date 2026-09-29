import { Repository } from 'typeorm';
import { AiProvider, AiProviderAlert, AiProviderFailure, AiProviderKey, AiProviderUsageMetric } from './provider-management.entity';
type ProviderFailureType = 'quota' | 'billing' | 'rate_limit' | 'invalid_key' | 'timeout' | 'provider_error';
export declare class ProviderManagementService {
    private readonly providerRepo;
    private readonly keyRepo;
    private readonly failureRepo;
    private readonly alertRepo;
    private readonly usageRepo;
    private readonly logger;
    private readonly algorithm;
    private readonly keyCache;
    constructor(providerRepo: Repository<AiProvider>, keyRepo: Repository<AiProviderKey>, failureRepo: Repository<AiProviderFailure>, alertRepo: Repository<AiProviderAlert>, usageRepo: Repository<AiProviderUsageMetric>);
    private getClientOrigin;
    onModuleInit(): Promise<void>;
    getAdminDashboard(): Promise<{
        providers: {
            providerKey: string;
            displayName: string;
            enabled: boolean;
            priority: number;
            status: string;
            lastSuccessAt: Date;
            lastFailureAt: Date;
            lastFailureReason: string;
            activeKeyFingerprint: string;
            backupKeyCount: number;
            keys: {
                id: string;
                providerKey: string;
                label: string;
                fingerprint: string;
                status: string;
                priority: number;
                isActive: boolean;
                lastTestedAt: Date;
                lastSuccessAt: Date;
                lastFailureAt: Date;
                lastFailureReason: string;
                createdBy: string;
                createdAt: Date;
                updatedAt: Date;
            }[];
        }[];
        alerts: AiProviderAlert[];
        failures: AiProviderFailure[];
        metrics: AiProviderUsageMetric[];
        summary: {
            healthy: number;
            degraded: number;
            openAlerts: number;
            managedKeys: number;
        };
    }>;
    saveKey(input: {
        providerKey: string;
        apiKey: string;
        label?: string;
        activate?: boolean;
        priority?: number;
        createdBy?: string;
        testBeforeActivate?: boolean;
    }): Promise<{
        key: {
            id: string;
            providerKey: string;
            label: string;
            fingerprint: string;
            status: string;
            priority: number;
            isActive: boolean;
            lastTestedAt: Date;
            lastSuccessAt: Date;
            lastFailureAt: Date;
            lastFailureReason: string;
            createdBy: string;
            createdAt: Date;
            updatedAt: Date;
        };
        test: {
            ok: boolean;
            status: string;
            message: string;
        };
    }>;
    testKey(keyId: string): Promise<{
        key: {
            id: string;
            providerKey: string;
            label: string;
            fingerprint: string;
            status: string;
            priority: number;
            isActive: boolean;
            lastTestedAt: Date;
            lastSuccessAt: Date;
            lastFailureAt: Date;
            lastFailureReason: string;
            createdBy: string;
            createdAt: Date;
            updatedAt: Date;
        };
        test: {
            ok: boolean;
            status: string;
            message: string;
        };
    }>;
    setProviderEnabled(providerKeyInput: string, enabled: boolean): Promise<AiProvider>;
    setKeyActive(keyId: string): Promise<{
        id: string;
        providerKey: string;
        label: string;
        fingerprint: string;
        status: string;
        priority: number;
        isActive: boolean;
        lastTestedAt: Date;
        lastSuccessAt: Date;
        lastFailureAt: Date;
        lastFailureReason: string;
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    disableKey(keyId: string): Promise<{
        id: string;
        providerKey: string;
        label: string;
        fingerprint: string;
        status: string;
        priority: number;
        isActive: boolean;
        lastTestedAt: Date;
        lastSuccessAt: Date;
        lastFailureAt: Date;
        lastFailureReason: string;
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getActiveApiKey(providerKeyInput: string): Promise<{
        apiKey: string;
        keyId: string;
        fingerprint: string | null;
    } | null>;
    recordSuccess(providerKeyInput: string, keyId: string | null, moduleKey?: string, latencyMs?: number, promptTokens?: number, completionTokens?: number): Promise<void>;
    recordFailure(providerKeyInput: string, keyId: string | null, error: any, moduleKey?: string, model?: string): Promise<void>;
    classifyError(error: any): {
        httpStatus: number | null;
        failureType: ProviderFailureType;
        safeMessage: string;
    };
    sanitizeError(value: string): string;
    private ensureProviders;
    private assertProvider;
    private testRawKey;
    private getEncryptionKey;
    private encrypt;
    private decrypt;
    private fingerprint;
    private serializeKey;
    private invalidate;
    private statusFromFailure;
    private promoteBackupKey;
    private createAlert;
    private incrementUsage;
    private getPhysicalIpAddress;
    private sendProviderAlertEmail;
    private escapeHtml;
    private sendSmtp;
}
export {};
