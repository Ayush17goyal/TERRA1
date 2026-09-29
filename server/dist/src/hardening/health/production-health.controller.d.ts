import { DataSource } from 'typeorm';
import type { Response } from 'express';
import { SupabaseService } from '../../modules/settings/supabase.service';
import { QdrantService } from '../../modules/retrieval/qdrant.service';
export declare class ProductionHealthController {
    private readonly dataSource;
    private readonly supabaseService;
    private readonly qdrantService;
    private readonly env;
    constructor(dataSource: DataSource, supabaseService: SupabaseService, qdrantService: QdrantService);
    live(): {
        status: string;
        uptime: number;
        timestamp: string;
    };
    ready(): Promise<{
        status: string;
        timestamp: string;
        checks: Record<string, {
            status: string;
            latencyMs?: number;
            message?: string;
        }>;
    }>;
    metrics(res: Response): Promise<void>;
    private check;
}
