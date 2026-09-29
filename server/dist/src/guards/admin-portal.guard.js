"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminPortalGuard = void 0;
const common_1 = require("@nestjs/common");
let AdminPortalGuard = class AdminPortalGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const key = request.headers['x-admin-key'] || '';
        const adminId = process.env.ADMIN_PORTAL_ID;
        const production = process.env.NODE_ENV === 'production';
        if (!production && adminId && key === adminId) {
            return true;
        }
        const user = request.user || {};
        const email = String(user.email || '').toLowerCase();
        const role = String(user.role || '').toLowerCase();
        const allowed = new Set((process.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));
        if (allowed.has(email) || ['admin', 'super_admin', 'founder', 'cto', 'developer'].includes(role)) {
            return true;
        }
        throw new common_1.ForbiddenException('Administrative access required.');
    }
};
exports.AdminPortalGuard = AdminPortalGuard;
exports.AdminPortalGuard = AdminPortalGuard = __decorate([
    (0, common_1.Injectable)()
], AdminPortalGuard);
//# sourceMappingURL=admin-portal.guard.js.map