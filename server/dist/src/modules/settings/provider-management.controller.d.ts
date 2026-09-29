import { ProviderManagementService } from './provider-management.service';
export declare class ProviderManagementController {
    private readonly providers;
    constructor(providers: ProviderManagementService);
    dashboard(): Promise<{
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
        alerts: import("./provider-management.entity").AiProviderAlert[];
        failures: import("./provider-management.entity").AiProviderFailure[];
        metrics: import("./provider-management.entity").AiProviderUsageMetric[];
        summary: {
            healthy: number;
            degraded: number;
            openAlerts: number;
            managedKeys: number;
        };
    }>;
    saveKey(req: any, body: {
        providerKey: string;
        apiKey: string;
        label?: string;
        activate?: boolean;
        priority?: number;
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
    testKey(id: string): Promise<{
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
    activateKey(id: string): Promise<{
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
    disableKey(id: string): Promise<{
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
    enableProvider(providerKey: string): Promise<import("./provider-management.entity").AiProvider>;
    disableProvider(providerKey: string): Promise<import("./provider-management.entity").AiProvider>;
}
