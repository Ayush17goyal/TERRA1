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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractController = void 0;
const common_1 = require("@nestjs/common");
const contract_service_1 = require("./contract.service");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const admin_role_guard_1 = require("../../guards/admin-role.guard");
const settings_service_1 = require("../settings/settings.service");
let ContractController = class ContractController {
    constructor(contractService, settings) {
        this.contractService = contractService;
        this.settings = settings;
    }
    async getActiveConfig() {
        return this.contractService.getActiveConfig();
    }
    async downloadPdf(res) {
        const config = await this.contractService.getActiveConfig();
        return this.contractService.generatePdf(config.contractContent, config.contractVersion, res);
    }
    async getAcceptanceStatus(req) {
        const config = await this.contractService.getActiveConfig();
        return this.contractService.getAcceptanceStatus(req.user.id, config.contractVersion);
    }
    async acceptContract(req, body) {
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const email = body.email || req.user.email || '';
        const result = await this.contractService.recordAcceptance(req.user.id, email, ipAddress, userAgent, body.contractVersion);
        await this.settings.log({
            userId: req.user.id,
            module: 'IP & Contract Compliance',
            action: 'Accepted Contract',
            metadata: { contractVersion: body.contractVersion, email, ipAddress, userAgent },
        });
        return result;
    }
    async updateConfig(req, body) {
        const result = await this.contractService.updateConfig(body.contractVersion, body.contractContent);
        await this.settings.log({
            userId: req.user.id,
            module: 'IP & Contract Compliance',
            action: 'Updated Contract Config',
            metadata: { contractVersion: body.contractVersion },
        });
        return result;
    }
    async getAdminAcceptances() {
        return this.contractService.getAllAcceptances();
    }
    async reviewContract(body, req) {
        const result = await this.contractService.review(req.user.id, body.fileName, body.fileUrl);
        await this.settings.log({
            userId: req.user.id,
            module: 'Compliance Copilot',
            action: 'Reviewed Contract',
            metadata: { contractId: result.contractId, fileName: body.fileName, riskScore: result.overallRiskScore },
        });
        await this.settings.log({
            userId: req.user.id,
            module: 'Compliance Copilot',
            action: 'Generated Risk Report',
            metadata: { contractId: result.contractId, riskScore: result.overallRiskScore },
        });
        return result;
    }
    async getRisks(id) {
        return this.contractService.getRisks(id);
    }
    async generateClauseRecommendations(id, body) {
        return this.contractService.recommendClause(id, body.clauseTitle);
    }
};
exports.ContractController = ContractController;
__decorate([
    (0, common_1.Get)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ContractController.prototype, "getActiveConfig", null);
__decorate([
    (0, common_1.Get)('download-pdf'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ContractController.prototype, "downloadPdf", null);
__decorate([
    (0, common_1.Get)('acceptance-status'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ContractController.prototype, "getAcceptanceStatus", null);
__decorate([
    (0, common_1.Post)('accept'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ContractController.prototype, "acceptContract", null);
__decorate([
    (0, common_1.Put)('admin/config'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ContractController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Get)('admin/acceptances'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ContractController.prototype, "getAdminAcceptances", null);
__decorate([
    (0, common_1.Post)('review'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ContractController.prototype, "reviewContract", null);
__decorate([
    (0, common_1.Get)(':id/risks'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContractController.prototype, "getRisks", null);
__decorate([
    (0, common_1.Post)(':id/clauses'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ContractController.prototype, "generateClauseRecommendations", null);
exports.ContractController = ContractController = __decorate([
    (0, common_1.Controller)('contracts'),
    __metadata("design:paramtypes", [contract_service_1.ContractService,
        settings_service_1.SettingsService])
], ContractController);
//# sourceMappingURL=contract.controller.js.map