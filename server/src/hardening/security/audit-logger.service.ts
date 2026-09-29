import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../../modules/settings/supabase.service';
import { securityEvents } from '../observability/metrics';

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

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);
  constructor(private readonly supabase: SupabaseService) {}

  async record(event: AuditEvent) {
    securityEvents.labels(event.action, event.severity).inc();
    this.logger.log(JSON.stringify({ ...event, metadata: this.redact(event.metadata) }));
    if (!this.supabase.isConfigured()) return;
    try {
      await axios.post(`${this.supabase.supabaseUrl}/rest/v1/audit_logs`, {
        actor_id: event.actorId || null,
        actor_role: event.actorRole || null,
        action: event.action,
        resource_type: event.resourceType,
        resource_id: event.resourceId || null,
        outcome: event.outcome,
        severity: event.severity,
        correlation_id: event.correlationId || null,
        metadata: this.redact(event.metadata || {}),
        created_at: new Date().toISOString(),
      }, { headers: this.supabase.getHeaders() });
    } catch (error: any) {
      this.logger.warn(`Audit persistence failed: ${error.message}`);
    }
  }

  private redact(value: any): any {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [/token|secret|key|password|authorization|cookie/i.test(key) ? [key, '[REDACTED]'] : [key, this.redact(item)]]));
  }
}