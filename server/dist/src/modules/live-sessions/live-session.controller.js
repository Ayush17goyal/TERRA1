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
exports.LiveSessionController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const admin_portal_guard_1 = require("../../guards/admin-portal.guard");
const live_session_service_1 = require("./live-session.service");
let LiveSessionController = class LiveSessionController {
    constructor(service) {
        this.service = service;
    }
    listSessions() {
        return this.service.listSessions();
    }
    adminListSessions() {
        return this.service.adminListSessions();
    }
    getMeetLink(id, req) {
        const userId = req.user?.id ?? 'anonymous';
        return this.service.getMeetLink(id, userId);
    }
    schedule(body) {
        return this.service.scheduleLiveClass(body);
    }
    update(id, body) {
        return this.service.updateLiveClass(id, body);
    }
    cancel(id) {
        return this.service.cancelSession(id);
    }
    remove(id) {
        return this.service.deleteSession(id);
    }
};
exports.LiveSessionController = LiveSessionController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LiveSessionController.prototype, "listSessions", null);
__decorate([
    (0, common_1.Get)('admin'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LiveSessionController.prototype, "adminListSessions", null);
__decorate([
    (0, common_1.Get)(':id/meet-link'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LiveSessionController.prototype, "getMeetLink", null);
__decorate([
    (0, common_1.Post)('admin/schedule'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LiveSessionController.prototype, "schedule", null);
__decorate([
    (0, common_1.Put)('admin/:id'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LiveSessionController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('admin/:id/cancel'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LiveSessionController.prototype, "cancel", null);
__decorate([
    (0, common_1.Delete)('admin/:id'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LiveSessionController.prototype, "remove", null);
exports.LiveSessionController = LiveSessionController = __decorate([
    (0, common_1.Controller)('live-sessions'),
    __metadata("design:paramtypes", [live_session_service_1.LiveSessionService])
], LiveSessionController);
//# sourceMappingURL=live-session.controller.js.map