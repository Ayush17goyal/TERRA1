"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuditLoggerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLoggerService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
const supabase_service_1 = require("../../modules/settings/supabase.service");
const metrics_1 = require("../observability/metrics");
let AuditLoggerService = AuditLoggerService_1 = class AuditLoggerService {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = new common_1.Logger(AuditLoggerService_1.name);
    }
    async record(event) {
        metrics_1.securityEvents.labels(event.action, event.severity).inc();
        this.logger.log(JSON.stringify({ ...event, metadata: this.redact(event.metadata) }));
        if (!this.supabase.isConfigured())
            return;
        try {
            await axios_1.default.post(`${this.supabase.supabaseUrl}/rest/v1/audit_logs`, {
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
        }
        catch (error) {
            this.logger.warn(`Audit persistence failed: ${error.message}`);
        }
    }
    redact(value) {
        if (!value || typeof value !== 'object')
            return value;
        if (Array.isArray(value))
            return value.map((item) => this.redact(item));
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [/token|secret|key|password|authorization|cookie/i.test(key) ? [key, '[REDACTED]'] : [key, this.redact(item)]]));
    }
};
exports.AuditLoggerService = AuditLoggerService;
exports.AuditLoggerService = AuditLoggerService = AuditLoggerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], AuditLoggerService);
//# sourceMappingURL=audit-logger.service.js.map