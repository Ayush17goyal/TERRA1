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
exports.StudentVerificationController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const student_verification_service_1 = require("./student-verification.service");
let StudentVerificationController = class StudentVerificationController {
    constructor(service) {
        this.service = service;
    }
    async submitVerification(req, body, files) {
        const userId = req.user.id;
        return this.service.submitRequest(userId, body, files || []);
    }
    async getStatus(req) {
        const userId = req.user.id;
        const request = await this.service.getRequestByUser(userId);
        if (!request) {
            return { status: 'unsubmitted' };
        }
        return request;
    }
    async listAllRequests(req) {
        this.enforceAdmin(req);
        return this.service.getAdminList();
    }
    async getAnalytics(req) {
        this.enforceAdmin(req);
        return this.service.getAnalytics();
    }
    async approveRequest(req, id) {
        this.enforceAdmin(req);
        return this.service.approveRequest(id, req.user.id);
    }
    async rejectRequest(req, id, reason) {
        this.enforceAdmin(req);
        return this.service.rejectRequest(id, req.user.id, reason || 'Incomplete academic documents.');
    }
    async getDocument(req, id, res) {
        const isUserAdmin = this.isAdmin(req);
        const { buffer, fileName, mimeType } = await this.service.getDocumentFile(id);
        if (!isUserAdmin) {
            const request = await this.service.getRequestByUser(req.user.id);
            if (!request)
                throw new common_1.ForbiddenException('Access denied');
            const docs = await this.service.getDocumentsForRequest(request.id);
            const ownsDoc = docs.some(d => d.id === id);
            if (!ownsDoc)
                throw new common_1.ForbiddenException('Access denied');
        }
        res.set({
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${fileName}"`,
        });
        res.send(buffer);
    }
    isAdmin(req) {
        const email = req.user.email;
        const isMock = req.user.id === 'mock_clerk_id_123';
        return email === 'admin@legatrixon.com' || email === 'legatrixon2026@gmail.com' || req.user.role === 'admin' || isMock;
    }
    enforceAdmin(req) {
        if (!this.isAdmin(req)) {
            throw new common_1.ForbiddenException('Admin access privileges required.');
        }
    }
};
exports.StudentVerificationController = StudentVerificationController;
__decorate([
    (0, common_1.Post)('submit'),
    (0, common_1.UseInterceptors)((0, platform_express_1.AnyFilesInterceptor)()),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Array]),
    __metadata("design:returntype", Promise)
], StudentVerificationController.prototype, "submitVerification", null);
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StudentVerificationController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('admin/list'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StudentVerificationController.prototype, "listAllRequests", null);
__decorate([
    (0, common_1.Get)('admin/analytics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StudentVerificationController.prototype, "getAnalytics", null);
__decorate([
    (0, common_1.Post)('admin/:id/approve'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], StudentVerificationController.prototype, "approveRequest", null);
__decorate([
    (0, common_1.Post)('admin/:id/reject'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], StudentVerificationController.prototype, "rejectRequest", null);
__decorate([
    (0, common_1.Get)('documents/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], StudentVerificationController.prototype, "getDocument", null);
exports.StudentVerificationController = StudentVerificationController = __decorate([
    (0, common_1.Controller)('student-verification'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [student_verification_service_1.StudentVerificationService])
], StudentVerificationController);
//# sourceMappingURL=student-verification.controller.js.map