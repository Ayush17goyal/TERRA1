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
exports.ApiUsageError = exports.DemoModeAuditLog = exports.DemoModeSetting = exports.FeatureUsageCounter = void 0;
const typeorm_1 = require("typeorm");
let FeatureUsageCounter = class FeatureUsageCounter {
};
exports.FeatureUsageCounter = FeatureUsageCounter;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FeatureUsageCounter.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], FeatureUsageCounter.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'feature_key' }),
    __metadata("design:type", String)
], FeatureUsageCounter.prototype, "featureKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'plan_key' }),
    __metadata("design:type", String)
], FeatureUsageCounter.prototype, "planKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'period_key' }),
    __metadata("design:type", String)
], FeatureUsageCounter.prototype, "periodKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'used_count', default: 0 }),
    __metadata("design:type", Number)
], FeatureUsageCounter.prototype, "usedCount", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], FeatureUsageCounter.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], FeatureUsageCounter.prototype, "updatedAt", void 0);
exports.FeatureUsageCounter = FeatureUsageCounter = __decorate([
    (0, typeorm_1.Entity)('feature_usage_counters'),
    (0, typeorm_1.Unique)(['userId', 'featureKey', 'periodKey'])
], FeatureUsageCounter);
let DemoModeSetting = class DemoModeSetting {
};
exports.DemoModeSetting = DemoModeSetting;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', default: 'global' }),
    __metadata("design:type", String)
], DemoModeSetting.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], DemoModeSetting.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'limit_per_feature_per_day', default: 4 }),
    __metadata("design:type", Number)
], DemoModeSetting.prototype, "limitPerFeaturePerDay", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Asia/Kolkata' }),
    __metadata("design:type", String)
], DemoModeSetting.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_by', nullable: true }),
    __metadata("design:type", String)
], DemoModeSetting.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], DemoModeSetting.prototype, "updatedAt", void 0);
exports.DemoModeSetting = DemoModeSetting = __decorate([
    (0, typeorm_1.Entity)('demo_mode_settings')
], DemoModeSetting);
let DemoModeAuditLog = class DemoModeAuditLog {
};
exports.DemoModeAuditLog = DemoModeAuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DemoModeAuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'admin_id' }),
    __metadata("design:type", String)
], DemoModeAuditLog.prototype, "adminId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DemoModeAuditLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'old_value', type: 'simple-json' }),
    __metadata("design:type", Object)
], DemoModeAuditLog.prototype, "oldValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'new_value', type: 'simple-json' }),
    __metadata("design:type", Object)
], DemoModeAuditLog.prototype, "newValue", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DemoModeAuditLog.prototype, "createdAt", void 0);
exports.DemoModeAuditLog = DemoModeAuditLog = __decorate([
    (0, typeorm_1.Entity)('demo_mode_audit_logs')
], DemoModeAuditLog);
let ApiUsageError = class ApiUsageError {
};
exports.ApiUsageError = ApiUsageError;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ApiUsageError.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', nullable: true }),
    __metadata("design:type", String)
], ApiUsageError.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'feature_key' }),
    __metadata("design:type", String)
], ApiUsageError.prototype, "featureKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_code', nullable: true }),
    __metadata("design:type", String)
], ApiUsageError.prototype, "errorCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'http_status', nullable: true }),
    __metadata("design:type", Number)
], ApiUsageError.prototype, "httpStatus", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ApiUsageError.prototype, "createdAt", void 0);
exports.ApiUsageError = ApiUsageError = __decorate([
    (0, typeorm_1.Entity)('api_usage_errors')
], ApiUsageError);
//# sourceMappingURL=feature-usage.entity.js.map