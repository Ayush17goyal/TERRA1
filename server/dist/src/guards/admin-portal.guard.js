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
const backend_1 = require("@clerk/backend");
const admin_credentials_1 = require("../security/admin-credentials");
let AdminPortalGuard = class AdminPortalGuard {
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authHeader = String(request.headers.authorization || '');
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
        const portalSession = (0, admin_credentials_1.verifyAdminSessionToken)(token);
        if (portalSession) {
            request.user = {
                id: portalSession.sub,
                email: null,
                role: portalSession.role,
                trustedRole: portalSession.role,
                authProvider: 'admin-portal',
            };
            return true;
        }
        const secretKey = process.env.CLERK_SECRET_KEY;
        if (token && secretKey) {
            try {
                const claims = await (0, backend_1.verifyToken)(token, { secretKey, clockSkewInMs: 120000 });
                if (claims.sub) {
                    const clerk = (0, backend_1.createClerkClient)({ secretKey });
                    const clerkUser = await clerk.users.getUser(claims.sub);
                    const primaryEmail = clerkUser.emailAddresses.find((item) => item.id === clerkUser.primaryEmailAddressId) || clerkUser.emailAddresses[0];
                    request.user = {
                        id: clerkUser.id,
                        email: primaryEmail?.emailAddress || null,
                        role: clerkUser.privateMetadata?.role || clerkUser.publicMetadata?.role || null,
                        trustedRole: clerkUser.privateMetadata?.role || clerkUser.publicMetadata?.role || null,
                        authProvider: 'clerk',
                    };
                }
            }
            catch {
            }
        }
        const user = request.user || {};
        const email = String(user.email || '').toLowerCase();
        const role = String(user.trustedRole || user.role || '').toLowerCase();
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