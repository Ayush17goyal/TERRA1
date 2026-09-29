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
exports.UserByokUsageMetric = exports.UserApiKey = void 0;
const typeorm_1 = require("typeorm");
let UserApiKey = class UserApiKey {
};
exports.UserApiKey = UserApiKey;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserApiKey.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], UserApiKey.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserApiKey.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'api_key_encrypted', type: 'text' }),
    __metadata("design:type", String)
], UserApiKey.prototype, "apiKeyEncrypted", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'encryption_iv' }),
    __metadata("design:type", String)
], UserApiKey.prototype, "encryptionIv", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'encryption_tag' }),
    __metadata("design:type", String)
], UserApiKey.prototype, "encryptionTag", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'key_fingerprint', nullable: true }),
    __metadata("design:type", String)
], UserApiKey.prototype, "keyFingerprint", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Connected' }),
    __metadata("design:type", String)
], UserApiKey.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_verified_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], UserApiKey.prototype, "lastVerifiedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserApiKey.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UserApiKey.prototype, "updatedAt", void 0);
exports.UserApiKey = UserApiKey = __decorate([
    (0, typeorm_1.Entity)('user_api_keys'),
    (0, typeorm_1.Unique)(['userId', 'provider'])
], UserApiKey);
let UserByokUsageMetric = class UserByokUsageMetric {
};
exports.UserByokUsageMetric = UserByokUsageMetric;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserByokUsageMetric.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], UserByokUsageMetric.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requests_user_keys', default: 0 }),
    __metadata("design:type", Number)
], UserByokUsageMetric.prototype, "requestsUserKeys", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requests_legatrixon_keys', default: 0 }),
    __metadata("design:type", Number)
], UserByokUsageMetric.prototype, "requestsLegatrixonKeys", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cache_hits', default: 0 }),
    __metadata("design:type", Number)
], UserByokUsageMetric.prototype, "cacheHits", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'estimated_api_calls_saved', default: 0 }),
    __metadata("design:type", Number)
], UserByokUsageMetric.prototype, "estimatedApiCallsSaved", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserByokUsageMetric.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UserByokUsageMetric.prototype, "updatedAt", void 0);
exports.UserByokUsageMetric = UserByokUsageMetric = __decorate([
    (0, typeorm_1.Entity)('user_byok_usage_metrics'),
    (0, typeorm_1.Unique)(['userId'])
], UserByokUsageMetric);
//# sourceMappingURL=byok.entity.js.map