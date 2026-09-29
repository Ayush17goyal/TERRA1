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
exports.ProviderManagementController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const admin_role_guard_1 = require("../../guards/admin-role.guard");
const provider_management_service_1 = require("./provider-management.service");
let ProviderManagementController = class ProviderManagementController {
    constructor(providers) {
        this.providers = providers;
    }
    async dashboard() {
        return this.providers.getAdminDashboard();
    }
    async saveKey(req, body) {
        return this.providers.saveKey({
            ...body,
            createdBy: req.user?.email || req.user?.id || 'admin',
        });
    }
    async testKey(id) {
        return this.providers.testKey(id);
    }
    async activateKey(id) {
        return this.providers.setKeyActive(id);
    }
    async disableKey(id) {
        return this.providers.disableKey(id);
    }
    async enableProvider(providerKey) {
        return this.providers.setProviderEnabled(providerKey, true);
    }
    async disableProvider(providerKey) {
        return this.providers.setProviderEnabled(providerKey, false);
    }
};
exports.ProviderManagementController = ProviderManagementController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProviderManagementController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Post)('keys'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProviderManagementController.prototype, "saveKey", null);
__decorate([
    (0, common_1.Post)('keys/:id/test'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProviderManagementController.prototype, "testKey", null);
__decorate([
    (0, common_1.Post)('keys/:id/activate'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProviderManagementController.prototype, "activateKey", null);
__decorate([
    (0, common_1.Post)('keys/:id/disable'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProviderManagementController.prototype, "disableKey", null);
__decorate([
    (0, common_1.Post)(':providerKey/enable'),
    __param(0, (0, common_1.Param)('providerKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProviderManagementController.prototype, "enableProvider", null);
__decorate([
    (0, common_1.Post)(':providerKey/disable'),
    __param(0, (0, common_1.Param)('providerKey')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProviderManagementController.prototype, "disableProvider", null);
exports.ProviderManagementController = ProviderManagementController = __decorate([
    (0, common_1.Controller)('admin/providers'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:paramtypes", [provider_management_service_1.ProviderManagementService])
], ProviderManagementController);
//# sourceMappingURL=provider-management.controller.js.map