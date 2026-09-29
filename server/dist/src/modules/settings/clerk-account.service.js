"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClerkAccountService = void 0;
const common_1 = require("@nestjs/common");
const backend_1 = require("@clerk/backend");
let ClerkAccountService = class ClerkAccountService {
    get client() {
        const secretKey = process.env.CLERK_SECRET_KEY;
        if (!secretKey) {
            throw new common_1.ServiceUnavailableException('Clerk is not configured');
        }
        return (0, backend_1.createClerkClient)({ secretKey });
    }
    async getSecurity(userId) {
        const [user, response] = await Promise.all([
            this.client.users.getUser(userId),
            this.client.sessions.getSessionList({ userId, limit: 100 }),
        ]);
        const sessions = response.data.filter((session) => session.status === 'active');
        return {
            clerkConnected: true,
            activeSessionsAvailable: true,
            activeSessions: sessions.length,
            deviceHistoryAvailable: true,
            deviceHistory: sessions.map((session) => ({
                sessionId: session.id,
                device: [
                    session.latestActivity?.browserName,
                    session.latestActivity?.deviceType,
                ].filter(Boolean).join(' on ') || 'Unknown device',
                location: [
                    session.latestActivity?.city,
                    session.latestActivity?.country,
                ].filter(Boolean).join(', ') || null,
                lastSeen: session.lastActiveAt || session.updatedAt || session.createdAt,
            })),
            passwordStatus: user.passwordEnabled ? 'Password enabled' : 'No password configured',
            twoFactorStatus: user.twoFactorEnabled ? 'Enabled' : 'Not enabled',
        };
    }
    async revokeAllSessions(userId) {
        const response = await this.client.sessions.getSessionList({ userId, limit: 100 });
        const activeSessions = response.data.filter((session) => session.status === 'active');
        await Promise.all(activeSessions.map((session) => this.client.sessions.revokeSession(session.id)));
        return activeSessions.length;
    }
    async deleteUser(userId) {
        await this.client.users.deleteUser(userId);
    }
    async getUser(userId) {
        return this.client.users.getUser(userId);
    }
    async updateClerkUser(userId, data) {
        const updateData = {};
        if (data.fullName) {
            updateData.firstName = data.fullName;
        }
        updateData.unsafeMetadata = {
            phone: data.phoneNumber || '',
            collegeName: data.university || '',
            yearOfStudy: data.yearOfStudy || '',
        };
        updateData.publicMetadata = {
            university: data.university || '',
            yearOfStudy: data.yearOfStudy || '',
        };
        return this.client.users.updateUser(userId, updateData);
    }
};
exports.ClerkAccountService = ClerkAccountService;
exports.ClerkAccountService = ClerkAccountService = __decorate([
    (0, common_1.Injectable)()
], ClerkAccountService);
//# sourceMappingURL=clerk-account.service.js.map