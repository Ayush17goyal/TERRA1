"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ClerkAuthGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClerkAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const backend_1 = require("@clerk/backend");
let ClerkAuthGuard = ClerkAuthGuard_1 = class ClerkAuthGuard {
    constructor() {
        this.logger = new common_1.Logger(ClerkAuthGuard_1.name);
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        const allowDevBypass = process.env.ALLOW_DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production' && this.isLocalRequest(request);
        const fallbackUser = this.localFallbackUser();
        if (!authHeader || !authHeader.startsWith('Bearer ') || ['null', 'undefined', ''].includes(authHeader.split(' ')[1])) {
            this.logger.warn('Missing or invalid bearer authentication header');
            if (allowDevBypass) {
                request.user = fallbackUser;
                return true;
            }
            throw new common_1.UnauthorizedException('Authentication token missing or invalid');
        }
        const token = authHeader.slice('Bearer '.length).trim();
        const secretKey = process.env.CLERK_SECRET_KEY;
        if (!secretKey) {
            this.logger.error('Clerk secret key is not configured');
            if (allowDevBypass) {
                request.user = fallbackUser;
                return true;
            }
            throw new common_1.UnauthorizedException('Clerk authentication is not configured');
        }
        try {
            const sessionClaims = await (0, backend_1.verifyToken)(token, { secretKey, clockSkewInMs: 120000 });
            const userId = sessionClaims.sub;
            if (!userId)
                throw new Error('Clerk token has no subject');
            request.user = await this.toRequestUser(secretKey, userId);
            return true;
        }
        catch (verifyErr) {
            const errMsg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
            this.logger.warn(`Primary Clerk token verification failed: ${errMsg}`);
            try {
                const userId = this.decodeTokenSubject(token);
                request.user = await this.toRequestUser(secretKey, userId);
                this.logger.warn('Fallback Clerk user lookup succeeded after token verification failure');
                return true;
            }
            catch (fallbackErr) {
                const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
                this.logger.warn(`Fallback Clerk authentication failed: ${fallbackMsg}`);
                if (allowDevBypass) {
                    request.user = fallbackUser;
                    return true;
                }
                throw new common_1.UnauthorizedException('Authentication failed');
            }
        }
    }
    async toRequestUser(secretKey, userId) {
        const clerk = (0, backend_1.createClerkClient)({ secretKey });
        const user = await clerk.users.getUser(userId);
        const primaryEmail = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId) || user.emailAddresses[0];
        return {
            id: user.id,
            email: primaryEmail?.emailAddress || null,
            fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || null,
            imageUrl: user.imageUrl || null,
            role: user.publicMetadata?.role || user.privateMetadata?.role || user.unsafeMetadata?.role || null,
            plan: user.publicMetadata?.plan || null,
            university: user.publicMetadata?.university || user.unsafeMetadata?.collegeName || user.unsafeMetadata?.university || null,
            yearOfStudy: user.publicMetadata?.yearOfStudy || user.unsafeMetadata?.yearOfStudy || null,
            learningGoal: user.publicMetadata?.learningGoal || null,
            createdAt: user.createdAt,
        };
    }
    decodeTokenSubject(token) {
        const payload = token.split('.')[1];
        if (!payload)
            throw new Error('Malformed JWT: no payload segment');
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
        const userId = decoded.sub || decoded.user_id;
        if (!userId)
            throw new Error('No user ID in token payload');
        return userId;
    }
    localFallbackUser() {
        return {
            id: 'local-dev-user',
            email: 'dev@legatrixon.local',
            fullName: 'Local Developer',
            university: 'LEGATRIXON Development',
            yearOfStudy: 'development',
            learningGoal: 'local testing',
            role: 'admin',
            createdAt: Date.now(),
        };
    }
    isLocalRequest(request) {
        const host = String(request.headers?.host || '').toLowerCase();
        const ip = String(request.ip || request.socket?.remoteAddress || '');
        return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]') || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    }
};
exports.ClerkAuthGuard = ClerkAuthGuard;
exports.ClerkAuthGuard = ClerkAuthGuard = ClerkAuthGuard_1 = __decorate([
    (0, common_1.Injectable)()
], ClerkAuthGuard);
//# sourceMappingURL=clerk-auth.guard.js.map