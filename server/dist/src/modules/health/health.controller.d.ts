import { DataSource } from 'typeorm';
import { SupabaseService } from '../settings/supabase.service';
import { QdrantService } from '../retrieval/qdrant.service';
type HealthCheck = {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'configured' | 'not_configured' | 'unknown';
    message?: string;
};
export declare class HealthController {
    private readonly dataSource;
    private readonly supabaseService;
    private readonly qdrantService;
    constructor(dataSource: DataSource, supabaseService: SupabaseService, qdrantService: QdrantService);
    getHealth(): Promise<{
        status: string;
        timestamp: string;
        environment: string;
        uptime: number;
        checks: Record<string, HealthCheck>;
    }>;
    getApiHealth(): Promise<{
        status: string;
        timestamp: string;
        environment: string;
        uptime: number;
        checks: Record<string, HealthCheck>;
    }>;
    private checkAll;
    private withTimeout;
}
export {};
