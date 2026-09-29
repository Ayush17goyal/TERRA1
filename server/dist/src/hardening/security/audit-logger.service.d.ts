import { SupabaseService } from '../../modules/settings/supabase.service';
export interface AuditEvent {
    actorId?: string;
    actorRole?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    outcome: 'success' | 'denied' | 'failed';
    severity: 'info' | 'warning' | 'error' | 'critical';
    correlationId?: string;
    metadata?: Record<string, unknown>;
}
export declare class AuditLoggerService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    record(event: AuditEvent): Promise<void>;
    private redact;
}
