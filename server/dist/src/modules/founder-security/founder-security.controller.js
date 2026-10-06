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
exports.SecurityTestController = exports.FounderSecurityController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const admin_role_guard_1 = require("../../guards/admin-role.guard");
const founder_security_service_1 = require("./founder-security.service");
let FounderSecurityController = class FounderSecurityController {
    constructor(founderSecurityService) {
        this.founderSecurityService = founderSecurityService;
    }
    getClientOrigin() {
        const explicitOrigin = process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS?.split(',')[0];
        const origin = explicitOrigin?.trim().replace(/\/+$/, '');
        if (origin)
            return origin;
        if (process.env.NODE_ENV === 'production') {
            throw new Error('CLIENT_ORIGINS must be configured in production.');
        }
        return 'http://localhost:5173';
    }
    async getSettings() {
        return this.founderSecurityService.getSettings();
    }
    async getAdminAnalytics() {
        return this.founderSecurityService.getAdminAnalytics();
    }
    async updateSettings(body) {
        return this.founderSecurityService.updateSettings(body);
    }
    async listEvents() {
        return this.founderSecurityService.listEvents();
    }
    async recordEvent(req, body) {
        return this.founderSecurityService.recordSecurityEvent({
            eventType: body.eventType,
            title: body.title,
            message: body.message,
            actorId: body.actorId || req.user?.id,
            actorEmail: body.actorEmail || req.user?.email,
            ipAddress: this.getIpAddress(req),
            userAgent: req.headers['user-agent'],
            metadata: body.metadata || {},
        });
    }
    async clearLocks() {
        return this.founderSecurityService.clearAllLocks();
    }
    async adminLogin(req, body) {
        const role = String(body.role || '').trim();
        const adminId = String(body.adminId || '').trim();
        const expectedAdminId = process.env.ADMIN_PORTAL_ID || '';
        const passwordHash = process.env.ADMIN_PORTAL_PASSWORD_HASH || '';
        const ipAddress = this.getIpAddress(req);
        const userAgent = req.headers['user-agent'] || 'Unknown';
        if (!['Founder', 'CTO', 'Developer'].includes(role)) {
            return { ok: false, message: 'Role selection is required.' };
        }
        if (!expectedAdminId || !passwordHash) {
            return { ok: false, message: 'Admin login is not configured. Follow the secure admin recovery procedure.' };
        }
        const lockCheck = await this.founderSecurityService.isAccountLocked(adminId, role);
        if (lockCheck.locked) {
            const formattedTime = new Date(lockCheck.lockedUntil).toLocaleString();
            return {
                ok: false,
                locked: true,
                message: `This account has been locked due to multiple security failures. Please try again after 48 hours (locked until ${formattedTime}).`
            };
        }
        await this.founderSecurityService.recordSecurityEvent({
            eventType: 'ADMIN_LOGIN_ATTEMPT',
            title: 'Admin Login Attempts',
            message: `Admin login attempt detected for ID ${adminId || 'unknown'} with role ${role}.`,
            actorId: adminId || 'unknown',
            actorEmail: 'admin-console@legatrixon.local',
            ipAddress,
            userAgent,
            metadata: { adminId, role },
        });
        if (adminId === expectedAdminId && this.founderSecurityService.verifySecret(body.password, passwordHash)) {
            const approvalToken = await this.founderSecurityService.initiateLoginApproval(adminId, role, ipAddress, userAgent);
            return { ok: true, step2Required: false, pendingApproval: true, token: approvalToken };
        }
        await this.founderSecurityService.recordSecurityEvent({
            eventType: 'ADMIN_LOGIN_FAILED',
            title: 'Failed Login Attempts',
            message: `Admin login rejected for ID ${adminId || 'unknown'} (role ${role}).`,
            actorId: adminId || 'unknown',
            actorEmail: 'admin-console@legatrixon.local',
            ipAddress,
            userAgent,
            metadata: { adminId, role },
        });
        return { ok: false, message: 'Invalid Administrator Credentials.' };
    }
    async verifyQuestion(req, body) {
        const sessionToken = String(body.sessionToken || '').trim();
        const answer = String(body.answer || '').trim();
        return this.founderSecurityService.verifySecurityQuestion(sessionToken, answer);
    }
    async loginApprove(token) {
        const success = await this.founderSecurityService.approveLogin(token);
        if (success) {
            const clientOrigin = this.getClientOrigin();
            return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Login Approved</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }
    .icon { font-size: 56px; color: #10b981; margin-bottom: 20px; line-height: 1; }
    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    p { font-size: 14px; color: #94a3b8; margin: 0 0 28px; line-height: 1.6; }
    .status-badge { display: inline-block; padding: 6px 16px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 30px; color: #10b981; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✔</div>
    <h1>Access Authorized</h1>
    <p>Administrative access to the LEGATRIXON Console has been approved. Redirecting to the admin portal...</p>
    <span class="status-badge">Approved Successfully</span>
    <div style="font-size: 11px; color: #64748b; margin-top: 28px;">If you are not redirected automatically, <a href="${clientOrigin}/admin" style="color: #10b981; text-decoration: none; font-weight: bold;">click here</a>.</div>
  </div>
  <script>
    setTimeout(() => {
      window.location.href = "${clientOrigin}/admin";
    }, 1500);
  </script>
</body>
</html>
      `;
        }
        else {
            return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invalid Request</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }
    .icon { font-size: 56px; color: #f43f5e; margin-bottom: 20px; line-height: 1; }
    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    p { font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✖</div>
    <h1>Invalid or Expired Request</h1>
    <p>This authorization token has either expired, been processed, or is invalid.</p>
  </div>
</body>
</html>
      `;
        }
    }
    async loginReject(token) {
        const success = await this.founderSecurityService.rejectLogin(token);
        if (success) {
            return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Access Blocked</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }
    .icon { font-size: 56px; color: #f43f5e; margin-bottom: 20px; line-height: 1; }
    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    p { font-size: 14px; color: #94a3b8; margin: 0 0 28px; line-height: 1.6; }
    .status-badge { display: inline-block; padding: 6px 16px; background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 30px; color: #f43f5e; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✖</div>
    <h1>Access Blocked</h1>
    <p>Administrative access to the LEGATRIXON Console has been blocked. This failed login event has been logged for security audit.</p>
    <span class="status-badge">Rejected</span>
    <div style="font-size: 11px; color: #64748b; margin-top: 28px;">You can safely close this browser window.</div>
  </div>
</body>
</html>
      `;
        }
        else {
            return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invalid Request</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }
    .icon { font-size: 56px; color: #f43f5e; margin-bottom: 20px; line-height: 1; }
    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    p { font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✖</div>
    <h1>Invalid or Expired Request</h1>
    <p>This authorization token has either expired, been processed, or is invalid.</p>
  </div>
</body>
</html>
      `;
        }
    }
    async loginStatus(token) {
        const attempt = this.founderSecurityService.getLoginApprovalStatus(token);
        if (!attempt) {
            return { status: 'invalid' };
        }
        return { status: attempt.status };
    }
    async requestClerkAccess(req, body) {
        const role = String(body.role || '').trim();
        const adminId = String(body.adminId || '').trim();
        const answer = String(body.answer || '').trim();
        const ipAddress = this.getIpAddress(req);
        const userAgent = req.headers['user-agent'] || 'Unknown';
        return this.founderSecurityService.requestClerkAccess({
            role,
            adminId,
            answer,
            ipAddress,
            userAgent,
        });
    }
    async approveClerkAccess(token) {
        const success = await this.founderSecurityService.approveClerkAccess(token);
        const clientOrigin = this.getClientOrigin();
        if (success) {
            return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Access Approved</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }
    .icon { font-size: 56px; color: #10b981; margin-bottom: 20px; line-height: 1; }
    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    p { font-size: 14px; color: #94a3b8; margin: 0 0 28px; line-height: 1.6; }
    .status-badge { display: inline-block; padding: 6px 16px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 30px; color: #10b981; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✔</div>
    <h1>Access Authorized</h1>
    <p>Clerk Dashboard Access has been approved. Redirecting to the admin portal...</p>
    <span class="status-badge">Approved Successfully</span>
    <div style="font-size: 11px; color: #64748b; margin-top: 28px;">If you are not redirected automatically, <a href="${clientOrigin}/admin" style="color: #10b981; text-decoration: none; font-weight: bold;">click here</a>.</div>
  </div>
  <script>
    setTimeout(() => {
      window.location.href = "${clientOrigin}/admin?tab=Clerk%20Dashboard%20Access";
    }, 1500);
  </script>
</body>
</html>
      `;
        }
        else {
            return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invalid Request</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }
    .icon { font-size: 56px; color: #f43f5e; margin-bottom: 20px; line-height: 1; }
    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    p { font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✖</div>
    <h1>Invalid or Expired Request</h1>
    <p>This authorization token has either expired, been processed, or is invalid.</p>
  </div>
</body>
</html>
      `;
        }
    }
    async rejectClerkAccess(token) {
        const success = await this.founderSecurityService.rejectClerkAccess(token);
        if (success) {
            return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Access Blocked</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }
    .icon { font-size: 56px; color: #f43f5e; margin-bottom: 20px; line-height: 1; }
    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    p { font-size: 14px; color: #94a3b8; margin: 0 0 28px; line-height: 1.6; }
    .status-badge { display: inline-block; padding: 6px 16px; background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 30px; color: #f43f5e; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✖</div>
    <h1>Access Blocked</h1>
    <p>Clerk Dashboard Access has been blocked. This failed login event has been logged for security audit.</p>
    <span class="status-badge">Rejected</span>
    <div style="font-size: 11px; color: #64748b; margin-top: 28px;">You can safely close this browser window.</div>
  </div>
</body>
</html>
      `;
        }
        else {
            return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invalid Request</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }
    .icon { font-size: 56px; color: #f43f5e; margin-bottom: 20px; line-height: 1; }
    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    p { font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✖</div>
    <h1>Invalid or Expired Request</h1>
    <p>This authorization token has either expired, been processed, or is invalid.</p>
  </div>
</body>
</html>
      `;
        }
    }
    async clerkAccessStatus(token) {
        const attempt = this.founderSecurityService.getClerkAccessStatus(token);
        if (!attempt) {
            return { status: 'invalid' };
        }
        return { status: attempt.status };
    }
    async clerkAccessSessionCheck(sessionToken) {
        const result = this.founderSecurityService.checkClerkAccessSession(sessionToken);
        return result;
    }
    getIpAddress(req) {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string' && forwarded.trim()) {
            return forwarded.split(',')[0].trim();
        }
        return req.ip || req.socket?.remoteAddress || '';
    }
};
exports.FounderSecurityController = FounderSecurityController;
__decorate([
    (0, common_1.Get)('settings'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Get)('admin-analytics'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "getAdminAnalytics", null);
__decorate([
    (0, common_1.Put)('settings'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Get)('events'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "listEvents", null);
__decorate([
    (0, common_1.Post)('events'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "recordEvent", null);
__decorate([
    (0, common_1.Get)('clear-locks'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "clearLocks", null);
__decorate([
    (0, common_1.Post)('admin-login'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "adminLogin", null);
__decorate([
    (0, common_1.Post)('verify-question'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "verifyQuestion", null);
__decorate([
    (0, common_1.Get)('login-approve'),
    (0, common_1.Header)('Content-Type', 'text/html'),
    __param(0, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "loginApprove", null);
__decorate([
    (0, common_1.Get)('login-reject'),
    (0, common_1.Header)('Content-Type', 'text/html'),
    __param(0, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "loginReject", null);
__decorate([
    (0, common_1.Get)('login-status'),
    __param(0, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "loginStatus", null);
__decorate([
    (0, common_1.Post)('clerk-access/request'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "requestClerkAccess", null);
__decorate([
    (0, common_1.Get)('clerk-access/approve'),
    (0, common_1.Header)('Content-Type', 'text/html'),
    __param(0, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "approveClerkAccess", null);
__decorate([
    (0, common_1.Get)('clerk-access/reject'),
    (0, common_1.Header)('Content-Type', 'text/html'),
    __param(0, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "rejectClerkAccess", null);
__decorate([
    (0, common_1.Get)('clerk-access/status'),
    __param(0, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "clerkAccessStatus", null);
__decorate([
    (0, common_1.Get)('clerk-access/session-check'),
    __param(0, (0, common_1.Query)('sessionToken')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FounderSecurityController.prototype, "clerkAccessSessionCheck", null);
exports.FounderSecurityController = FounderSecurityController = __decorate([
    (0, common_1.Controller)('founder-security'),
    __metadata("design:paramtypes", [founder_security_service_1.FounderSecurityService])
], FounderSecurityController);
let SecurityTestController = class SecurityTestController {
    constructor(founderSecurityService) {
        this.founderSecurityService = founderSecurityService;
    }
    async testEmailGet(req) {
        return this.sendTestEmail(req);
    }
    async testEmailPost(req) {
        return this.sendTestEmail(req);
    }
    async sendTestEmail(req) {
        const ipAddress = this.getIpAddress(req);
        const userAgent = req.headers['user-agent'] || 'Test Client';
        try {
            const result = await this.founderSecurityService.recordSecurityEvent({
                eventType: 'ADMIN_LOGIN_ATTEMPT',
                title: 'Test Email Dispatch',
                message: 'This is a manually triggered test email to verify SMTP functionality and Gmail App Password authentication.',
                actorId: 'test-endpoint',
                actorEmail: 'test-endpoint@legatrixon.local',
                ipAddress,
                userAgent,
                metadata: { isTest: true, timestamp: new Date().toISOString() }
            }, { waitForDelivery: true });
            if (result.deliveryStatus === 'failed') {
                return {
                    success: false,
                    error: result.deliveryError || 'Unknown SMTP error',
                    message: 'Failed to send test email to legatrixon2026@gmail.com'
                };
            }
            return {
                success: true,
                message: 'Test email successfully sent to legatrixon2026@gmail.com',
                deliveryStatus: result.deliveryStatus,
                timestamp: result.createdAt
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                stack: error.stack,
                message: 'Internal error while processing test email'
            };
        }
    }
    getIpAddress(req) {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string' && forwarded.trim()) {
            return forwarded.split(',')[0].trim();
        }
        return req.ip || req.socket?.remoteAddress || '';
    }
};
exports.SecurityTestController = SecurityTestController;
__decorate([
    (0, common_1.Get)('test-email'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SecurityTestController.prototype, "testEmailGet", null);
__decorate([
    (0, common_1.Post)('test-email'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard, admin_role_guard_1.AdminRoleGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SecurityTestController.prototype, "testEmailPost", null);
exports.SecurityTestController = SecurityTestController = __decorate([
    (0, common_1.Controller)('api/security'),
    __metadata("design:paramtypes", [founder_security_service_1.FounderSecurityService])
], SecurityTestController);
//# sourceMappingURL=founder-security.controller.js.map