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
exports.AnalyticsEngineController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const analytics_engine_service_1 = require("./analytics-engine.service");
let AnalyticsEngineController = class AnalyticsEngineController {
    constructor(analytics) {
        this.analytics = analytics;
    }
    async dashboard(req) {
        return this.analytics.getDashboard(req.user.id);
    }
    async topics(req) {
        return this.analytics.getTopicPerformance(req.user.id);
    }
    async weakTopics(req) {
        return this.analytics.getWeakTopics(req.user.id);
    }
    async strongTopics(req) {
        return this.analytics.getStrongTopics(req.user.id);
    }
    async progress(req) {
        return this.analytics.getProgress(req.user.id);
    }
};
exports.AnalyticsEngineController = AnalyticsEngineController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalyticsEngineController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('topics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalyticsEngineController.prototype, "topics", null);
__decorate([
    (0, common_1.Get)('weak-topics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalyticsEngineController.prototype, "weakTopics", null);
__decorate([
    (0, common_1.Get)('strong-topics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalyticsEngineController.prototype, "strongTopics", null);
__decorate([
    (0, common_1.Get)('progress'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalyticsEngineController.prototype, "progress", null);
exports.AnalyticsEngineController = AnalyticsEngineController = __decorate([
    (0, common_1.Controller)('exam-engine/analytics'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [analytics_engine_service_1.AnalyticsEngineService])
], AnalyticsEngineController);
//# sourceMappingURL=analytics-engine.controller.js.map