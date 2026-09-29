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
exports.ContractAcceptance = exports.ContractConfig = void 0;
const typeorm_1 = require("typeorm");
let ContractConfig = class ContractConfig {
};
exports.ContractConfig = ContractConfig;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ContractConfig.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'contract_version', default: '1.0.0' }),
    __metadata("design:type", String)
], ContractConfig.prototype, "contractVersion", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { name: 'contract_content' }),
    __metadata("design:type", String)
], ContractConfig.prototype, "contractContent", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'last_updated' }),
    __metadata("design:type", Date)
], ContractConfig.prototype, "lastUpdated", void 0);
exports.ContractConfig = ContractConfig = __decorate([
    (0, typeorm_1.Entity)('contract_configs')
], ContractConfig);
let ContractAcceptance = class ContractAcceptance {
};
exports.ContractAcceptance = ContractAcceptance;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ContractAcceptance.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', nullable: true }),
    __metadata("design:type", String)
], ContractAcceptance.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ContractAcceptance.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'timestamp' }),
    __metadata("design:type", Date)
], ContractAcceptance.prototype, "timestamp", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ip_address', nullable: true }),
    __metadata("design:type", String)
], ContractAcceptance.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'browser_user_agent', nullable: true }),
    __metadata("design:type", String)
], ContractAcceptance.prototype, "browserUserAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'contract_version' }),
    __metadata("design:type", String)
], ContractAcceptance.prototype, "contractVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ContractAcceptance.prototype, "accepted", void 0);
exports.ContractAcceptance = ContractAcceptance = __decorate([
    (0, typeorm_1.Entity)('contract_acceptances')
], ContractAcceptance);
//# sourceMappingURL=contract.entities.js.map