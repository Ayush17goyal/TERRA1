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
exports.MasterclassController = void 0;
const common_1 = require("@nestjs/common");
const backend_1 = require("@clerk/backend");
const masterclass_service_1 = require("./masterclass.service");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const admin_portal_guard_1 = require("../../guards/admin-portal.guard");
let MasterclassController = class MasterclassController {
    constructor(svc) {
        this.svc = svc;
    }
    adminListCourses() {
        return this.svc.adminListCourses();
    }
    adminCreateCourse(dto) {
        return this.svc.adminCreateCourse(dto);
    }
    adminUpdateCourse(id, dto) {
        return this.svc.adminUpdateCourse(id, dto);
    }
    adminDeleteCourse(id) {
        return this.svc.adminDeleteCourse(id);
    }
    adminPublishCourse(id) {
        return this.svc.adminPublishCourse(id, true);
    }
    adminUnpublishCourse(id) {
        return this.svc.adminPublishCourse(id, false);
    }
    adminListLessons(courseId) {
        return this.svc.adminListLessons(courseId);
    }
    adminCreateLesson(courseId, dto) {
        return this.svc.adminCreateLesson(courseId, dto);
    }
    adminUpdateLesson(id, dto) {
        return this.svc.adminUpdateLesson(id, dto);
    }
    adminDeleteLesson(id) {
        return this.svc.adminDeleteLesson(id);
    }
    async adminGrantPlan(dto) {
        const secretKey = process.env.CLERK_SECRET_KEY;
        if (!secretKey)
            return { error: 'Clerk not configured' };
        const clerk = (0, backend_1.createClerkClient)({ secretKey });
        const users = await clerk.users.getUserList({ emailAddress: [dto.email] });
        if (!users.data.length)
            return { error: `No user found with email: ${dto.email}` };
        const user = users.data[0];
        const existingMeta = user.publicMetadata || {};
        await clerk.users.updateUser(user.id, {
            publicMetadata: { ...existingMeta, plan: dto.plan || 'drafting' },
        });
        return { success: true, userId: user.id, email: dto.email, plan: dto.plan || 'drafting' };
    }
    async adminRevokePlan(dto) {
        const secretKey = process.env.CLERK_SECRET_KEY;
        if (!secretKey)
            return { error: 'Clerk not configured' };
        const clerk = (0, backend_1.createClerkClient)({ secretKey });
        const users = await clerk.users.getUserList({ emailAddress: [dto.email] });
        if (!users.data.length)
            return { error: `No user found with email: ${dto.email}` };
        const user = users.data[0];
        const existingMeta = user.publicMetadata || {};
        const { plan: _removed, ...rest } = existingMeta;
        await clerk.users.updateUser(user.id, { publicMetadata: rest });
        return { success: true, userId: user.id, email: dto.email };
    }
    studentListCourses() {
        return this.svc.studentListCourses();
    }
    studentGetCourse(id) {
        return this.svc.studentGetCourseWithLessons(id);
    }
    enroll(courseId, req) {
        const userId = req.auth?.userId ?? 'anonymous';
        return this.svc.enroll(courseId, userId);
    }
    updateProgress(lessonId, dto, req) {
        const userId = req.auth?.userId ?? 'anonymous';
        return this.svc.updateProgress(userId, lessonId, dto.courseId, dto);
    }
};
exports.MasterclassController = MasterclassController;
__decorate([
    (0, common_1.Get)('admin/courses'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "adminListCourses", null);
__decorate([
    (0, common_1.Post)('admin/courses'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "adminCreateCourse", null);
__decorate([
    (0, common_1.Put)('admin/courses/:id'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "adminUpdateCourse", null);
__decorate([
    (0, common_1.Delete)('admin/courses/:id'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "adminDeleteCourse", null);
__decorate([
    (0, common_1.Post)('admin/courses/:id/publish'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "adminPublishCourse", null);
__decorate([
    (0, common_1.Post)('admin/courses/:id/unpublish'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "adminUnpublishCourse", null);
__decorate([
    (0, common_1.Get)('admin/courses/:courseId/lessons'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Param)('courseId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "adminListLessons", null);
__decorate([
    (0, common_1.Post)('admin/courses/:courseId/lessons'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Param)('courseId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "adminCreateLesson", null);
__decorate([
    (0, common_1.Put)('admin/lessons/:id'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "adminUpdateLesson", null);
__decorate([
    (0, common_1.Delete)('admin/lessons/:id'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "adminDeleteLesson", null);
__decorate([
    (0, common_1.Post)('admin/grant-plan'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterclassController.prototype, "adminGrantPlan", null);
__decorate([
    (0, common_1.Post)('admin/revoke-plan'),
    (0, common_1.UseGuards)(admin_portal_guard_1.AdminPortalGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MasterclassController.prototype, "adminRevokePlan", null);
__decorate([
    (0, common_1.Get)('courses'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "studentListCourses", null);
__decorate([
    (0, common_1.Get)('courses/:id'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "studentGetCourse", null);
__decorate([
    (0, common_1.Post)('courses/:id/enroll'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "enroll", null);
__decorate([
    (0, common_1.Post)('lessons/:lessonId/progress'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __param(0, (0, common_1.Param)('lessonId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], MasterclassController.prototype, "updateProgress", null);
exports.MasterclassController = MasterclassController = __decorate([
    (0, common_1.Controller)('masterclass'),
    __metadata("design:paramtypes", [masterclass_service_1.MasterclassService])
], MasterclassController);
//# sourceMappingURL=masterclass.controller.js.map