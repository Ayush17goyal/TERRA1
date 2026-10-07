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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const admin_role_guard_1 = require("../../guards/admin-role.guard");
const settings_service_1 = require("./settings.service");
const feature_entitlement_service_1 = require("./feature-entitlement.service");
const DEMO_FEATURES = new Set(['drafting_mentor', 'case_law_reasoning', 'mock_test', 'legal_research', 'drafting_academy', 'lexmentor_ai', 'guidebot_ai', 'voice_ai', 'bare_act_ai', 'document_processing', 'judgment_ai', 'draft_analysis', 'academic_ai', 'memorial_ai']);
let SettingsController = class SettingsController {
    constructor(settings, entitlements) {
        this.settings = settings;
        this.entitlements = entitlements;
    }
    async getDemoMode() {
        return this.entitlements.getDemoConfig();
    }
    getLegalResearchCommandCenterAccess(req) {
        return this.entitlements.getLegalResearchCommandCenterAccess(req.user);
    }
    async getDemoUsage(req, feature) {
        if (!DEMO_FEATURES.has(feature))
            throw new common_1.BadRequestException('Unknown feature.');
        return this.entitlements.getUsage(req.user.id, feature);
    }
    async getDemoAdminOverview() {
        return this.entitlements.getAdminOverview();
    }
    async updateDemoMode(req, body) {
        return this.entitlements.updateDemoConfig(req.user.id, body);
    }
    async dashboard(req) {
        return this.settings.getDashboard(req.user);
    }
    async logActivity(req, body) {
        return this.settings.log({
            userId: req.user.id,
            module: body.module,
            action: body.action,
            metadata: body.metadata || {},
        });
    }
    async updateNotifications(req, body) {
        return this.settings.updateNotificationPreferences(req.user.id, body);
    }
    async requestAccountDeletion(req, body) {
        return this.settings.requestDeletion(req.user.id, body.reason);
    }
    async softDelete(req, body) {
        return this.settings.softDelete(req.user.id, body.confirmation);
    }
    async logoutAllDevices(req) {
        return this.settings.logoutAllDevices(req.user.id);
    }
    async dataRemovalRequest(req) {
        return this.settings.requestDataRemoval(req.user.id);
    }
    async permanentDelete(req, body) {
        return this.settings.permanentlyDelete(req.user.id, body.confirmation);
    }
    async exportData(req, res, kind, format) {
        const file = await this.settings.exportData(req.user, kind, format);
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        return res.send(file.buffer);
    }
    async createFeedback(req, body) {
        return this.settings.createFeedback(req.user.id, body);
    }
    async getFeedbacks(req) {
        return this.settings.getFeedbacks(req.user.id);
    }
    async getCommunityFeatures() {
        return this.settings.getCommunityFeatures();
    }
    async voteFeature(req, id) {
        return this.settings.voteFeature(req.user.id, id);
    }
    async getAdminFeedbacks() {
        return this.settings.getAdminFeedbacks();
    }
    async updateFeedbackStatus(id, body) {
        return this.settings.updateFeedbackStatus(id, body.status);
    }
    async registerFcmToken(req, body) {
        return this.settings.updateFcmToken(req.user.id, body.fcmToken);
    }
    async upgradeSubscription(req, body) {
        return this.settings.upgradeSubscription(req.user.id, body.planName);
    }
    async simulatePasswordChange(req) {
        return this.settings.simulatePasswordChange(req.user.id);
    }
    async triggerTestNotification(req, body) {
        return this.settings.triggerTestNotification(req.user.id, body.type);
    }
    async getProfile(req) {
        return this.settings.getProfile(req.user.id);
    }
    async getAiProviderOnboarding(req) {
        return this.settings.getAiProviderOnboarding(req.user);
    }
    async completeAiProviderOnboarding(req) {
        return this.settings.completeAiProviderOnboarding(req.user);
    }
    async updateProfile(req, body) {
        return this.settings.updateProfile(req.user.id, body);
    }
    async login(req, body) {
        return this.settings.recordLogin(req.user.id, body.email || req.user.email, req);
    }
    async logout(req) {
        return this.settings.recordLogout(req.user.id);
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Get)('demo-mode'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getDemoMode", null);
__decorate([
    (0, common_1.Get)('feature-access/legal-research-command-center'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getLegalResearchCommandCenterAccess", null);
__decorate([
    (0, common_1.Get)('demo-usage'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('feature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getDemoUsage", null);
__decorate([
    (0, common_1.Get)('demo-mode/admin-overview'),
    (0, common_1.UseGuards)(admin_role_guard_1.AdminRoleGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getDemoAdminOverview", null);
__decorate([
    (0, common_1.Put)('demo-mode'),
    (0, common_1.UseGuards)(admin_role_guard_1.AdminRoleGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateDemoMode", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Post)('activity'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "logActivity", null);
__decorate([
    (0, common_1.Post)('notifications'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateNotifications", null);
__decorate([
    (0, common_1.Post)('danger/account-deletion'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "requestAccountDeletion", null);
__decorate([
    (0, common_1.Post)('danger/soft-delete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "softDelete", null);
__decorate([
    (0, common_1.Post)('danger/logout-all-devices'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "logoutAllDevices", null);
__decorate([
    (0, common_1.Post)('danger/data-removal-request'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "dataRemovalRequest", null);
__decorate([
    (0, common_1.Post)('danger/permanent-delete'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "permanentDelete", null);
__decorate([
    (0, common_1.Get)('export/:kind/:format'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Param)('kind')),
    __param(3, (0, common_1.Param)('format')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "exportData", null);
__decorate([
    (0, common_1.Post)('feedback'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "createFeedback", null);
__decorate([
    (0, common_1.Get)('feedback/my'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getFeedbacks", null);
__decorate([
    (0, common_1.Get)('feedback/community'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getCommunityFeatures", null);
__decorate([
    (0, common_1.Post)('feedback/:id/vote'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "voteFeature", null);
__decorate([
    (0, common_1.Get)('feedback/admin'),
    (0, common_1.UseGuards)(admin_role_guard_1.AdminRoleGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getAdminFeedbacks", null);
__decorate([
    (0, common_1.Put)('feedback/:id/status'),
    (0, common_1.UseGuards)(admin_role_guard_1.AdminRoleGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateFeedbackStatus", null);
__decorate([
    (0, common_1.Post)('notifications/fcm-token'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "registerFcmToken", null);
__decorate([
    (0, common_1.Post)('subscription/upgrade'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "upgradeSubscription", null);
__decorate([
    (0, common_1.Post)('security/password-change'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "simulatePasswordChange", null);
__decorate([
    (0, common_1.Post)('notifications/test'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "triggerTestNotification", null);
__decorate([
    (0, common_1.Get)('profile'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Get)('ai-provider-onboarding'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getAiProviderOnboarding", null);
__decorate([
    (0, common_1.Post)('ai-provider-onboarding/complete'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "completeAiProviderOnboarding", null);
__decorate([
    (0, common_1.Put)('profile'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "logout", null);
exports.SettingsController = SettingsController = __decorate([
    (0, common_1.Controller)('settings'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [settings_service_1.SettingsService, feature_entitlement_service_1.FeatureEntitlementService])
], SettingsController);
//# sourceMappingURL=settings.controller.js.map