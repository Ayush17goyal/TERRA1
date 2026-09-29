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
exports.AiCreditTransaction = exports.UserAiCreditBalance = exports.AiPlanEntitlement = void 0;
const typeorm_1 = require("typeorm");
let AiPlanEntitlement = class AiPlanEntitlement {
};
exports.AiPlanEntitlement = AiPlanEntitlement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiPlanEntitlement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'plan_key' }),
    __metadata("design:type", String)
], AiPlanEntitlement.prototype, "planKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'module_key' }),
    __metadata("design:type", String)
], AiPlanEntitlement.prototype, "moduleKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'credit_limit', default: 0 }),
    __metadata("design:type", Number)
], AiPlanEntitlement.prototype, "creditLimit", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reset_period', default: 'lifetime' }),
    __metadata("design:type", String)
], AiPlanEntitlement.prototype, "resetPeriod", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_unlimited', default: false }),
    __metadata("design:type", Boolean)
], AiPlanEntitlement.prototype, "isUnlimited", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fair_usage_limit', default: 0 }),
    __metadata("design:type", Number)
], AiPlanEntitlement.prototype, "fairUsageLimit", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiPlanEntitlement.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], AiPlanEntitlement.prototype, "updatedAt", void 0);
exports.AiPlanEntitlement = AiPlanEntitlement = __decorate([
    (0, typeorm_1.Entity)('ai_plan_entitlements'),
    (0, typeorm_1.Unique)(['planKey', 'moduleKey'])
], AiPlanEntitlement);
let UserAiCreditBalance = class UserAiCreditBalance {
};
exports.UserAiCreditBalance = UserAiCreditBalance;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserAiCreditBalance.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], UserAiCreditBalance.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'module_key' }),
    __metadata("design:type", String)
], UserAiCreditBalance.prototype, "moduleKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'plan_key', default: 'free' }),
    __metadata("design:type", String)
], UserAiCreditBalance.prototype, "planKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'credits_granted', default: 0 }),
    __metadata("design:type", Number)
], UserAiCreditBalance.prototype, "creditsGranted", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'credits_used', default: 0 }),
    __metadata("design:type", Number)
], UserAiCreditBalance.prototype, "creditsUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'credits_remaining', default: 0 }),
    __metadata("design:type", Number)
], UserAiCreditBalance.prototype, "creditsRemaining", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reset_period', default: 'lifetime' }),
    __metadata("design:type", String)
], UserAiCreditBalance.prototype, "resetPeriod", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reset_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], UserAiCreditBalance.prototype, "resetAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserAiCreditBalance.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UserAiCreditBalance.prototype, "updatedAt", void 0);
exports.UserAiCreditBalance = UserAiCreditBalance = __decorate([
    (0, typeorm_1.Entity)('user_ai_credit_balances'),
    (0, typeorm_1.Unique)(['userId', 'moduleKey'])
], UserAiCreditBalance);
let AiCreditTransaction = class AiCreditTransaction {
};
exports.AiCreditTransaction = AiCreditTransaction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiCreditTransaction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], AiCreditTransaction.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'module_key' }),
    __metadata("design:type", String)
], AiCreditTransaction.prototype, "moduleKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'request_id', nullable: true }),
    __metadata("design:type", String)
], AiCreditTransaction.prototype, "requestId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'transaction_type' }),
    __metadata("design:type", String)
], AiCreditTransaction.prototype, "transactionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], AiCreditTransaction.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'free_plan' }),
    __metadata("design:type", String)
], AiCreditTransaction.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_used', nullable: true }),
    __metadata("design:type", String)
], AiCreditTransaction.prototype, "providerUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cache_status', nullable: true }),
    __metadata("design:type", String)
], AiCreditTransaction.prototype, "cacheStatus", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], AiCreditTransaction.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AiCreditTransaction.prototype, "createdAt", void 0);
exports.AiCreditTransaction = AiCreditTransaction = __decorate([
    (0, typeorm_1.Entity)('ai_credit_transactions')
], AiCreditTransaction);
//# sourceMappingURL=credit.entity.js.map