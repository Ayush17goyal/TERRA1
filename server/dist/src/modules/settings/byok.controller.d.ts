import { ByokService } from './byok.service';
export declare class ByokController {
    private readonly byok;
    constructor(byok: ByokService);
    saveKey(req: any, body: {
        provider: string;
        apiKey: string;
    }): Promise<{
        provider: string;
        status: string;
        lastVerifiedAt: Date | null;
        fingerprint: string;
    }>;
    deleteKey(req: any, provider: string): Promise<{
        deleted: boolean;
    }>;
    listKeys(req: any): Promise<{
        provider: string;
        status: string;
        lastVerifiedAt: Date | null;
        fingerprint: string | null;
    }[]>;
    getUsage(req: any): Promise<{
        requestsUserKeys: number;
        requestsLegatrixonKeys: number;
        cacheHits: number;
        estimatedApiCallsSaved: number;
    }>;
    getStatus(req: any): Promise<{
        providers: {
            provider: string;
            status: string;
            lastVerifiedAt: Date | null;
            fingerprint: string | null;
        }[];
    }>;
}
