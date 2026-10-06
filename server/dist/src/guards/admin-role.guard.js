"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRoleGuard = void 0;
const common_1 = require("@nestjs/common");
let AdminRoleGuard = class AdminRoleGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user || {};
        const email = String(user.email || '').toLowerCase();
        const role = String(user.role || '').toLowerCase();
        const allowedEmails = this.allowedAdminEmails();
        if (allowedEmails.has(email) ||
            role === 'admin' ||
            role === 'super_admin' ||
            role === 'founder' ||
            role === 'cto' ||
            role === 'developer') {
            return true;
        }
        throw new common_1.ForbiddenException('Administrative access required.');
    }
    allowedAdminEmails() {
        const configured = (process.env.ADMIN_EMAILS || process.env.FOUNDER_EMAILS || '')
            .split(',')
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean);
        return new Set(configured);
    }
};
exports.AdminRoleGuard = AdminRoleGuard;
exports.AdminRoleGuard = AdminRoleGuard = __decorate([
    (0, common_1.Injectable)()
], AdminRoleGuard);
//# sourceMappingURL=admin-role.guard.js.map