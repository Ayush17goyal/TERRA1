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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiProviderUsageMetric = exports.AiProviderAlert = exports.AiProviderFailure = exports.AiProviderKey = exports.AiProvider = void 0;
const typeorm_1 = require("typeorm");
let AiProvider = class AiProvider {
};
exports.AiProvider = AiProvider;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiProvider.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_key' }),
    __metadata("design:type", String)
], AiProvider.prototype, "providerKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'display_name' }),
    __metadata("design:type", String)
], AiProvider.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], AiProvider.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 100 }),
    __metadata("design:type", Number)
], AiProvider.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'healthy' }),
    __metadata("design:type", String)
], AiProvider.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_success_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], AiProvider.prototype, "lastSuccessAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_failure_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], AiProvider.prototype, "lastFailureAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_failure_reason', type: 'text', nullable: true }),
    __metadata("design:type", String)
], AiProvider.prototype, "lastFailureReason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiProvider.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], AiProvider.prototype, "updatedAt", void 0);
exports.AiProvider = AiProvider = __decorate([
    (0, typeorm_1.Entity)('ai_providers'),
    (0, typeorm_1.Unique)(['providerKey'])
], AiProvider);
let AiProviderKey = class AiProviderKey {
};
exports.AiProviderKey = AiProviderKey;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiProviderKey.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_key' }),
    __metadata("design:type", String)
], AiProviderKey.prototype, "providerKey", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiProviderKey.prototype, "label", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'encrypted_key', type: 'text' }),
    __metadata("design:type", String)
], AiProviderKey.prototype, "encryptedKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'encryption_iv' }),
    __metadata("design:type", String)
], AiProviderKey.prototype, "encryptionIv", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'encryption_tag' }),
    __metadata("design:type", String)
], AiProviderKey.prototype, "encryptionTag", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiProviderKey.prototype, "fingerprint", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'backup' }),
    __metadata("design:type", String)
], AiProviderKey.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 100 }),
    __metadata("design:type", Number)
], AiProviderKey.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', default: false }),
    __metadata("design:type", Boolean)
], AiProviderKey.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_tested_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], AiProviderKey.prototype, "lastTestedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_success_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], AiProviderKey.prototype, "lastSuccessAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_failure_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], AiProviderKey.prototype, "lastFailureAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_failure_reason', type: 'text', nullable: true }),
    __metadata("design:type", String)
], AiProviderKey.prototype, "lastFailureReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', nullable: true }),
    __metadata("design:type", String)
], AiProviderKey.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiProviderKey.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], AiProviderKey.prototype, "updatedAt", void 0);
exports.AiProviderKey = AiProviderKey = __decorate([
    (0, typeorm_1.Entity)('ai_provider_keys')
], AiProviderKey);
let AiProviderFailure = class AiProviderFailure {
};
exports.AiProviderFailure = AiProviderFailure;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiProviderFailure.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_key' }),
    __metadata("design:type", String)
], AiProviderFailure.prototype, "providerKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'key_fingerprint', nullable: true }),
    __metadata("design:type", String)
], AiProviderFailure.prototype, "keyFingerprint", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'http_status', type: 'int', nullable: true }),
    __metadata("design:type", Number)
], AiProviderFailure.prototype, "httpStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'failure_type' }),
    __metadata("design:type", String)
], AiProviderFailure.prototype, "failureType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'safe_message', type: 'text' }),
    __metadata("design:type", String)
], AiProviderFailure.prototype, "safeMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'request_module', nullable: true }),
    __metadata("design:type", String)
], AiProviderFailure.prototype, "requestModule", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiProviderFailure.prototype, "model", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiProviderFailure.prototype, "createdAt", void 0);
exports.AiProviderFailure = AiProviderFailure = __decorate([
    (0, typeorm_1.Entity)('ai_provider_failures')
], AiProviderFailure);
let AiProviderAlert = class AiProviderAlert {
};
exports.AiProviderAlert = AiProviderAlert;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiProviderAlert.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_key' }),
    __metadata("design:type", String)
], AiProviderAlert.prototype, "providerKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'warning' }),
    __metadata("design:type", String)
], AiProviderAlert.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'alert_type' }),
    __metadata("design:type", String)
], AiProviderAlert.prototype, "alertType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiProviderAlert.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], AiProviderAlert.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'open' }),
    __metadata("design:type", String)
], AiProviderAlert.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_sent', default: false }),
    __metadata("design:type", Boolean)
], AiProviderAlert.prototype, "emailSent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_sent_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], AiProviderAlert.prototype, "emailSentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'acknowledged_by', nullable: true }),
    __metadata("design:type", String)
], AiProviderAlert.prototype, "acknowledgedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'acknowledged_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], AiProviderAlert.prototype, "acknowledgedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolved_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], AiProviderAlert.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiProviderAlert.prototype, "createdAt", void 0);
exports.AiProviderAlert = AiProviderAlert = __decorate([
    (0, typeorm_1.Entity)('ai_provider_alerts')
], AiProviderAlert);
let AiProviderUsageMetric = class AiProviderUsageMetric {
};
exports.AiProviderUsageMetric = AiProviderUsageMetric;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiProviderUsageMetric.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_key' }),
    __metadata("design:type", String)
], AiProviderUsageMetric.prototype, "providerKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'key_fingerprint', nullable: true }),
    __metadata("design:type", String)
], AiProviderUsageMetric.prototype, "keyFingerprint", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'module_key', nullable: true }),
    __metadata("design:type", String)
], AiProviderUsageMetric.prototype, "moduleKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'request_count', default: 0 }),
    __metadata("design:type", Number)
], AiProviderUsageMetric.prototype, "requestCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'success_count', default: 0 }),
    __metadata("design:type", Number)
], AiProviderUsageMetric.prototype, "successCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'failure_count', default: 0 }),
    __metadata("design:type", Number)
], AiProviderUsageMetric.prototype, "failureCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rate_limit_count', default: 0 }),
    __metadata("design:type", Number)
], AiProviderUsageMetric.prototype, "rateLimitCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quota_failure_count', default: 0 }),
    __metadata("design:type", Number)
], AiProviderUsageMetric.prototype, "quotaFailureCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'avg_latency_ms', default: 0 }),
    __metadata("design:type", Number)
], AiProviderUsageMetric.prototype, "avgLatencyMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tokens_prompt', default: 0 }),
    __metadata("design:type", Number)
], AiProviderUsageMetric.prototype, "tokensPrompt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tokens_completion', default: 0 }),
    __metadata("design:type", Number)
], AiProviderUsageMetric.prototype, "tokensCompletion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'estimated_cost', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], AiProviderUsageMetric.prototype, "estimatedCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'window_start', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], AiProviderUsageMetric.prototype, "windowStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'window_end', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], AiProviderUsageMetric.prototype, "windowEnd", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiProviderUsageMetric.prototype, "createdAt", void 0);
exports.AiProviderUsageMetric = AiProviderUsageMetric = __decorate([
    (0, typeorm_1.Entity)('ai_provider_usage_metrics')
], AiProviderUsageMetric);
//# sourceMappingURL=provider-management.entity.js.map