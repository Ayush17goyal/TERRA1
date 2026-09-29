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
var FounderSecurityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FounderSecurityService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const net = require("net");
const tls = require("tls");
const os = require("os");
const founder_security_entities_1 = require("./founder-security.entities");
let FounderSecurityService = FounderSecurityService_1 = class FounderSecurityService {
    constructor(settingsRepo, eventRepo, lockRepo, dataSource) {
        this.settingsRepo = settingsRepo;
        this.eventRepo = eventRepo;
        this.lockRepo = lockRepo;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(FounderSecurityService_1.name);
        this.loginApprovals = new Map();
        this.pendingLogins = new Map();
        this.clerkApprovals = new Map();
        this.clerkSessions = new Map();
    }
    getPublicBackendOrigin() {
        const explicitOrigin = process.env.PUBLIC_BACKEND_URL || process.env.RENDER_EXTERNAL_URL;
        const origin = explicitOrigin?.trim().replace(/\/+$/, '');
        if (origin)
            return origin;
        if (process.env.NODE_ENV === 'production') {
            throw new Error('PUBLIC_BACKEND_URL must be configured in production for email approval links.');
        }
        const port = process.env.PORT || 3000;
        const host = process.env.SERVER_HOST || 'localhost';
        return `http://${host}:${port}`;
    }
    buildPublicApiUrl(pathname) {
        const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
        return `${this.getPublicBackendOrigin()}${normalizedPath}`;
    }
    buildIpApiUrl(pathname) {
        const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
        const port = process.env.PORT || 3000;
        const localIp = this.getPhysicalIpAddress();
        return `http://${localIp}:${port}${normalizedPath}`;
    }
    async isAccountLocked(username, role) {
        const lock = await this.lockRepo.findOne({
            where: { username, role },
            order: { lockedUntil: 'DESC' },
        });
        if (lock && lock.lockedUntil > new Date()) {
            return { locked: true, lockedUntil: lock.lockedUntil };
        }
        return { locked: false };
    }
    async clearAllLocks() {
        await this.lockRepo.clear();
        return { success: true };
    }
    async getFailedSecurityQuestionCount(username, role) {
        const events = await this.eventRepo.find({
            where: { actorId: username },
            order: { createdAt: 'DESC' },
            take: 20,
        });
        let failCount = 0;
        for (const event of events) {
            if (event.eventType === 'ADMIN_LOGIN_SUCCESS' || event.eventType === 'ACCOUNT_LOCKED') {
                break;
            }
            if (event.eventType === 'ADMIN_LOGIN_FAILED') {
                if (event.metadata && event.metadata.role === role && event.metadata.failedSecurityQuestion === true) {
                    failCount++;
                }
            }
        }
        return failCount;
    }
    async verifySecurityQuestion(sessionToken, answer) {
        const session = this.pendingLogins.get(sessionToken);
        if (!session) {
            return { ok: false, message: 'Invalid or expired login session.' };
        }
        const { adminId, role, ipAddress, userAgent } = session;
        const lockCheck = await this.isAccountLocked(adminId, role);
        if (lockCheck.locked) {
            this.pendingLogins.delete(sessionToken);
            return { ok: false, locked: true, message: 'This account has been locked due to multiple security failures. Please try again after 48 hours.' };
        }
        const questions = {
            Founder: { question: 'Name the person I hate the most', answer: 'Ayush kashyap' },
            CTO: { question: 'Which K-Drama do you like the most?', answer: 'twinkling watermelon' },
            Developer: { question: 'What is the founding date of LEGATRIXON?', answer: '20feb2026' },
        };
        const qConfig = questions[role];
        if (!qConfig) {
            return { ok: false, message: 'Invalid role configuration.' };
        }
        const isCorrect = String(answer || '').trim().toLowerCase() === qConfig.answer.toLowerCase();
        if (isCorrect) {
            this.pendingLogins.delete(sessionToken);
            const approvalToken = await this.initiateLoginApproval(adminId, role, ipAddress, userAgent);
            return { ok: true, pendingApproval: true, token: approvalToken };
        }
        else {
            await this.recordSecurityEvent({
                eventType: 'ADMIN_LOGIN_FAILED',
                title: 'Failed Security Question Answer',
                message: `Incorrect security question answer provided for ID ${adminId} (${role}). Question: "${qConfig.question}". Answer attempt: "${answer}".`,
                actorId: adminId,
                actorEmail: 'admin-console@legatrixon.local',
                ipAddress,
                userAgent,
                metadata: { adminId, role, failedSecurityQuestion: true, question: qConfig.question, answerAttempt: answer },
            });
            const failCount = await this.getFailedSecurityQuestionCount(adminId, role);
            const remaining = Math.max(0, 3 - failCount);
            if (failCount >= 3) {
                const lockedUntil = new Date();
                lockedUntil.setHours(lockedUntil.getHours() + 48);
                const newLock = this.lockRepo.create({
                    username: adminId,
                    role,
                    lockedUntil,
                    ipAddress,
                    userAgent,
                });
                await this.lockRepo.save(newLock);
                await this.recordSecurityEvent({
                    eventType: 'ACCOUNT_LOCKED',
                    title: 'Account Lock Events',
                    message: `Administrative account for ID ${adminId} (${role}) has been locked for 48 hours due to 3 consecutive security question failures.`,
                    actorId: adminId,
                    actorEmail: 'admin-console@legatrixon.local',
                    ipAddress,
                    userAgent,
                    metadata: { adminId, role, lockId: newLock.id, lockedUntil },
                }, { waitForDelivery: true });
                this.pendingLogins.delete(sessionToken);
                return {
                    ok: false,
                    locked: true,
                    message: 'Account locked for 48 hours due to 3 failed attempts.',
                };
            }
            return {
                ok: false,
                attemptsRemaining: remaining,
                message: `Incorrect security answer. ${remaining} attempts remaining.`,
            };
        }
    }
    async initiateLoginApproval(adminId, role, ipAddress, userAgent) {
        const token = 'apv_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        this.loginApprovals.set(token, {
            adminId,
            role,
            status: 'pending',
            ipAddress,
            userAgent,
            createdAt: new Date(),
        });
        const backendOrigin = process.env.PUBLIC_BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;
        const approveUrl = `${backendOrigin}/api/v1/founder-security/login-approve?token=${token}`;
        const rejectUrl = `${backendOrigin}/api/v1/founder-security/login-reject?token=${token}`;
        this.logger.log(`\n\n========== ADMIN LOGIN APPROVAL ==========`);
        this.logger.log(`Admin: ${adminId} (${role})`);
        this.logger.log(`APPROVE → ${approveUrl}`);
        this.logger.log(`REJECT  → ${rejectUrl}`);
        this.logger.log(`==========================================\n`);
        this.sendApprovalEmail(token, adminId, role, ipAddress, userAgent).catch((err) => {
            this.logger.error(`[FOUNDER SECURITY] Failed to send approval email: ${err.message}`);
        });
        return token;
    }
    getLoginApprovalStatus(token) {
        return this.loginApprovals.get(token) || null;
    }
    async approveLogin(token) {
        const attempt = this.loginApprovals.get(token);
        if (!attempt || attempt.status !== 'pending')
            return false;
        attempt.status = 'approved';
        const role = attempt.role || 'Founder';
        const rolePrefix = role.toLowerCase();
        const actorEmail = `${rolePrefix}-admin@legatrixon.local`;
        await this.recordSecurityEvent({
            eventType: 'ADMIN_LOGIN_SUCCESS',
            title: 'Successful Admin Logins',
            message: `Successful admin login accepted for ID ${attempt.adminId} with role ${role} via founder email approval.`,
            actorId: attempt.adminId,
            actorEmail,
            ipAddress: attempt.ipAddress,
            userAgent: attempt.userAgent,
            metadata: { adminId: attempt.adminId, role, approvedViaEmail: true },
        });
        await this.recordSecurityEvent({
            eventType: 'NEW_BROWSER_LOGIN',
            title: 'New Browser Logins',
            message: `Admin browser login recorded for ID ${attempt.adminId} (${role}).`,
            actorId: attempt.adminId,
            actorEmail,
            ipAddress: attempt.ipAddress,
            userAgent: attempt.userAgent,
            metadata: { adminId: attempt.adminId, role },
        });
        await this.recordSecurityEvent({
            eventType: 'NEW_DEVICE_LOGIN',
            title: 'New Device Logins',
            message: `Admin device login recorded for ID ${attempt.adminId} (${role}).`,
            actorId: attempt.adminId,
            actorEmail,
            ipAddress: attempt.ipAddress,
            userAgent: attempt.userAgent,
            metadata: { adminId: attempt.adminId, role },
        });
        await this.recordSecurityEvent({
            eventType: 'NEW_IP_LOGIN',
            title: 'New IP Address Logins',
            message: `Admin IP login recorded for ID ${attempt.adminId} (${role}).`,
            actorId: attempt.adminId,
            actorEmail,
            ipAddress: attempt.ipAddress,
            userAgent: attempt.userAgent,
            metadata: { adminId: attempt.adminId, role },
        });
        return true;
    }
    async rejectLogin(token) {
        const attempt = this.loginApprovals.get(token);
        if (!attempt || attempt.status !== 'pending')
            return false;
        attempt.status = 'rejected';
        const role = attempt.role || 'Founder';
        await this.recordSecurityEvent({
            eventType: 'ADMIN_LOGIN_FAILED',
            title: 'Failed Login Attempts',
            message: `Admin login rejected by founder via email for ID ${attempt.adminId} (${role}).`,
            actorId: attempt.adminId,
            actorEmail: 'admin-console@legatrixon.local',
            ipAddress: attempt.ipAddress,
            userAgent: attempt.userAgent,
            metadata: { adminId: attempt.adminId, role, rejectedViaEmail: true },
        });
        return true;
    }
    getLocalIpAddress() {
        return process.env.SERVER_HOST || 'localhost';
    }
    getPhysicalIpAddress() {
        const interfaces = os.networkInterfaces();
        const keys = Object.keys(interfaces).sort((a, b) => {
            const nameA = a.toLowerCase();
            const nameB = b.toLowerCase();
            const isPriA = nameA.includes('wi-fi') || nameA.includes('wifi') || nameA.includes('ethernet') || nameA.includes('wlan') || nameA.includes('lan') || nameA.includes('wireless');
            const isPriB = nameB.includes('wi-fi') || nameB.includes('wifi') || nameB.includes('ethernet') || nameB.includes('wlan') || nameB.includes('lan') || nameB.includes('wireless');
            if (isPriA && !isPriB)
                return -1;
            if (!isPriA && isPriB)
                return 1;
            return 0;
        });
        for (const name of keys) {
            const nameLower = name.toLowerCase();
            if (nameLower.includes('virtual') ||
                nameLower.includes('vbox') ||
                nameLower.includes('vmware') ||
                nameLower.includes('virtualbox') ||
                nameLower.includes('host-only') ||
                nameLower.includes('loopback') ||
                nameLower.includes('wsl') ||
                nameLower.includes('vethernet') ||
                nameLower.includes('pseudo')) {
                continue;
            }
            for (const netInterface of interfaces[name] || []) {
                if (netInterface.family === 'IPv4' &&
                    !netInterface.internal &&
                    !netInterface.address.startsWith('127.') &&
                    !netInterface.address.startsWith('169.254')) {
                    return netInterface.address;
                }
            }
        }
        for (const name of Object.keys(interfaces)) {
            for (const netInterface of interfaces[name] || []) {
                if (netInterface.family === 'IPv4' && !netInterface.internal && !netInterface.address.startsWith('127.')) {
                    return netInterface.address;
                }
            }
        }
        return 'localhost';
    }
    async requestClerkAccess(input) {
        const { role, adminId, answer, ipAddress, userAgent } = input;
        if (role !== 'Founder' && role !== 'CTO') {
            await this.recordSecurityEvent({
                eventType: 'ADMIN_LOGIN_FAILED',
                title: 'Clerk Dashboard Access Denied',
                message: `Unauthorized role attempt: ${adminId} (${role}) tried to request Clerk Dashboard Access.`,
                actorId: adminId,
                actorEmail: 'admin-console@legatrixon.local',
                ipAddress,
                userAgent,
                metadata: { adminId, role, portal: 'Clerk Dashboard', success: false, reason: 'Unauthorized role' },
            });
            return { ok: false, message: 'Access denied: Unauthorized role.' };
        }
        const isCorrect = String(answer || '').trim().toLowerCase() === 'k-dramas';
        if (!isCorrect) {
            await this.recordSecurityEvent({
                eventType: 'ADMIN_LOGIN_FAILED',
                title: 'Clerk Dashboard Verification Failed',
                message: `Clerk Dashboard security verification failed: Incorrect answer provided for ID ${adminId} (${role}).`,
                actorId: adminId,
                actorEmail: 'admin-console@legatrixon.local',
                ipAddress,
                userAgent,
                metadata: {
                    adminId,
                    role,
                    portal: 'Clerk Dashboard',
                    securityQuestionResult: 'Incorrect',
                    approvalStatus: 'Denied',
                },
            });
            return { ok: false, message: 'Incorrect security answer.' };
        }
        const token = 'apv_clerk_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        this.clerkApprovals.set(token, {
            adminId,
            role,
            status: 'pending',
            ipAddress,
            userAgent,
            createdAt: new Date(),
        });
        await this.recordSecurityEvent({
            eventType: 'ADMIN_LOGIN_ATTEMPT',
            title: 'Clerk Dashboard Verification Success',
            message: `Clerk Dashboard security verification succeeded: Correct answer provided for ID ${adminId} (${role}). Awaiting founder approval.`,
            actorId: adminId,
            actorEmail: 'admin-console@legatrixon.local',
            ipAddress,
            userAgent,
            metadata: {
                adminId,
                role,
                portal: 'Clerk Dashboard',
                securityQuestionResult: 'Correct',
                approvalStatus: 'Pending',
            },
        });
        this.sendClerkAccessEmail(token, adminId, role, ipAddress, userAgent).catch((err) => {
            this.logger.error(`[FOUNDER SECURITY] Failed to send Clerk access email: ${err.message}`);
        });
        return { ok: true, pendingApproval: true, token };
    }
    async approveClerkAccess(token) {
        const attempt = this.clerkApprovals.get(token);
        if (!attempt || attempt.status !== 'pending')
            return false;
        attempt.status = 'approved';
        const sessionToken = 'clerk_session_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        attempt.sessionToken = sessionToken;
        this.clerkSessions.set(sessionToken, { expiresAt: Date.now() + 15 * 60 * 1000 });
        const role = attempt.role;
        const actorEmail = `${role.toLowerCase()}-admin@legatrixon.local`;
        await this.recordSecurityEvent({
            eventType: 'ADMIN_LOGIN_SUCCESS',
            title: 'Clerk Dashboard Access Approved',
            message: `Clerk Dashboard access approved by founder for ID ${attempt.adminId} (${role}).`,
            actorId: attempt.adminId,
            actorEmail,
            ipAddress: attempt.ipAddress,
            userAgent: attempt.userAgent,
            metadata: {
                adminId: attempt.adminId,
                role,
                portal: 'Clerk Dashboard',
                securityQuestionResult: 'Correct',
                approvalStatus: 'Approved',
            },
        });
        return true;
    }
    async rejectClerkAccess(token) {
        const attempt = this.clerkApprovals.get(token);
        if (!attempt || attempt.status !== 'pending')
            return false;
        attempt.status = 'rejected';
        const role = attempt.role;
        await this.recordSecurityEvent({
            eventType: 'ADMIN_LOGIN_FAILED',
            title: 'Clerk Dashboard Access Rejected',
            message: `Clerk Dashboard access rejected by founder for ID ${attempt.adminId} (${role}).`,
            actorId: attempt.adminId,
            actorEmail: 'admin-console@legatrixon.local',
            ipAddress: attempt.ipAddress,
            userAgent: attempt.userAgent,
            metadata: {
                adminId: attempt.adminId,
                role,
                portal: 'Clerk Dashboard',
                securityQuestionResult: 'Correct',
                approvalStatus: 'Rejected',
            },
        });
        return true;
    }
    getClerkAccessStatus(token) {
        const attempt = this.clerkApprovals.get(token);
        if (!attempt)
            return null;
        return {
            status: attempt.status,
            sessionToken: attempt.sessionToken,
        };
    }
    checkClerkAccessSession(sessionToken) {
        const session = this.clerkSessions.get(sessionToken);
        if (!session)
            return { valid: false };
        if (session.expiresAt < Date.now()) {
            this.clerkSessions.delete(sessionToken);
            return { valid: false };
        }
        return { valid: true, expiresAt: session.expiresAt };
    }
    async sendClerkAccessEmail(token, adminId, role, ipAddress, userAgent) {
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || 587);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = process.env.SECURITY_EMAIL_FROM || user || founder_security_entities_1.FOUNDER_DEFAULT_EMAIL;
        const recipient = founder_security_entities_1.FOUNDER_DEFAULT_EMAIL;
        const subject = `[Action Required] Clerk Dashboard Access Request - ${role}`;
        const approveUrl = this.buildPublicApiUrl(`/api/v1/founder-security/clerk-access/approve?token=${token}`);
        const rejectUrl = this.buildPublicApiUrl(`/api/v1/founder-security/clerk-access/reject?token=${token}`);
        const approveUrlLocalhost = approveUrl;
        const rejectUrlLocalhost = rejectUrl;
        const approveUrlIp = this.buildIpApiUrl(`/api/v1/founder-security/clerk-access/approve?token=${token}`);
        const rejectUrlIp = this.buildIpApiUrl(`/api/v1/founder-security/clerk-access/reject?token=${token}`);
        const { browser, device } = this.parseUserAgent(userAgent);
        const time = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' (IST)';
        const htmlBody = `
<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #1e293b; border-radius: 16px; background-color: #0f172a; color: #f8fafc; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
  <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #1e293b; padding-bottom: 16px;">
    <span style="display: inline-block; width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); margin-bottom: 10px;"></span>
    <h2 style="color: #f8fafc; margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">LEGATRIXON Admin Shield</h2>
    <p style="color: #fbbf24; margin: 4px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">Clerk Dashboard Access Verification</p>
  </div>
  
  <div style="padding: 18px; background-color: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; margin-bottom: 24px;">
    <h3 style="margin-top: 0; color: #f8fafc; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em;">Verification Details</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 12px; color: #cbd5e1; line-height: 1.6;">
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; width: 120px;">ROLE:</td>
        <td style="padding: 6px 0; font-weight: 700; color: #f8fafc;">${role.toUpperCase()}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; width: 120px;">USERNAME:</td>
        <td style="padding: 6px 0; font-weight: 700; color: #f8fafc;">${adminId}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">IP ADDRESS:</td>
        <td style="padding: 6px 0; font-family: monospace; color: #fbbf24;">${ipAddress}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">TIMESTAMP:</td>
        <td style="padding: 6px 0; color: #f8fafc;">${time}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">DEVICE / OS:</td>
        <td style="padding: 6px 0; color: #f8fafc;">${device}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; vertical-align: top;">BROWSER:</td>
        <td style="padding: 6px 0; color: #cbd5e1;">${browser}</td>
      </tr>
    </table>
  </div>
  
  <p style="color: #cbd5e1; font-size: 13px; line-height: 1.5; margin-bottom: 24px; text-align: center;">
    A request to access the Clerk Dashboard has been initiated. Please verify the request details above and authorize or reject access.
  </p>

  <p style="color: #fbbf24; font-size: 12px; line-height: 1.5; margin-bottom: 10px; text-align: center; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
    Option 1: If approving from Mobile Phone (on same Wi-Fi network)
  </p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" width="180" bgcolor="#d97706" style="border-radius: 8px;">
              <a href="${approveUrlIp}" target="_blank" style="display: inline-block; padding: 12px 18px; color: #ffffff; text-decoration: none; font-weight: 800; font-family: sans-serif; font-size: 11px; border: 1px solid #d97706; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em;">APPROVE (MOBILE/WI-FI)</a>
            </td>
            <td width="15"></td>
            <td align="center" width="180" bgcolor="#dc2626" style="border-radius: 8px;">
              <a href="${rejectUrlIp}" target="_blank" style="display: inline-block; padding: 12px 18px; color: #ffffff; text-decoration: none; font-weight: 800; font-family: sans-serif; font-size: 11px; border: 1px solid #dc2626; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em;">REJECT (MOBILE/WI-FI)</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <p style="color: #fbbf24; font-size: 12px; line-height: 1.5; margin-bottom: 10px; text-align: center; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
    Option 2: If approving from the same PC (Localhost)
  </p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" width="180" bgcolor="#d97706" style="border-radius: 8px;">
              <a href="${approveUrlLocalhost}" target="_blank" style="display: inline-block; padding: 12px 18px; color: #ffffff; text-decoration: none; font-weight: 800; font-family: sans-serif; font-size: 11px; border: 1px solid #d97706; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em;">APPROVE (SAME PC)</a>
            </td>
            <td width="15"></td>
            <td align="center" width="180" bgcolor="#dc2626" style="border-radius: 8px;">
              <a href="${rejectUrlLocalhost}" target="_blank" style="display: inline-block; padding: 12px 18px; color: #ffffff; text-decoration: none; font-weight: 800; font-family: sans-serif; font-size: 11px; border: 1px solid #dc2626; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em;">REJECT (SAME PC)</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  
  <div style="text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 16px; line-height: 1.4;">
    <strong>Security Warning:</strong> If you did not initiate this request, please click <strong>REJECT</strong> immediately.
  </div>
</div>
`;
        const rawMessage = [
            `From: ${from}`,
            `To: ${recipient}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            htmlBody,
        ].join('\r\n');
        if (!host || !user || !pass) {
            this.logger.warn('SMTP settings are missing. Displaying Clerk Dashboard Access raw email contents:');
            this.logger.warn(`=================== SECURITY NOTIFICATION EMAIL ===================`);
            this.logger.warn(`TO: ${recipient}`);
            this.logger.warn(`SUBJECT: ${subject}`);
            this.logger.warn(`BODY:\n${htmlBody}`);
            this.logger.warn(`===================================================================`);
            return;
        }
        await this.sendSmtp({ host, port, user, pass, from, to: [recipient], rawMessage });
    }
    async sendApprovalEmail(token, adminId, role, ipAddress, userAgent) {
        const settings = await this.getSettings();
        const recipients = this.resolveRecipients(settings);
        if (recipients.length === 0)
            throw new Error('Founder security email recipient missing.');
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || 587);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = process.env.SECURITY_EMAIL_FROM || user || founder_security_entities_1.FOUNDER_DEFAULT_EMAIL;
        const subject = `[Action Required] Admin Portal Login Authorization Request - ${role}`;
        const approveUrl = this.buildPublicApiUrl(`/api/v1/founder-security/login-approve?token=${token}`);
        const rejectUrl = this.buildPublicApiUrl(`/api/v1/founder-security/login-reject?token=${token}`);
        const approveUrlLocalhost = approveUrl;
        const rejectUrlLocalhost = rejectUrl;
        const approveUrlIp = this.buildIpApiUrl(`/api/v1/founder-security/login-approve?token=${token}`);
        const rejectUrlIp = this.buildIpApiUrl(`/api/v1/founder-security/login-reject?token=${token}`);
        const htmlBody = `
<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
  <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #edf2f7; padding-bottom: 16px;">
    <h2 style="color: #b58920; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">LEGATRIXON Admin Shield</h2>
    <p style="color: #718096; margin: 4px 0 0; font-size: 12px; font-weight: 600;">TWO-FACTOR AUTHORIZATION PORTAL</p>
  </div>
  
  <div style="padding: 18px; background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 12px; margin-bottom: 24px;">
    <h3 style="margin-top: 0; color: #2d3748; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em;">Login Attempt Verification</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #4a5568; line-height: 1.6;">
      <tr>
        <td style="padding: 6px 0; font-weight: 700; color: #718096; width: 110px;">ROLE:</td>
        <td style="padding: 6px 0; font-weight: 700; color: #1a202c;">${role.toUpperCase()}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 700; color: #718096; width: 110px;">ADMIN ID:</td>
        <td style="padding: 6px 0; font-weight: 700; color: #1a202c;">${adminId}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 700; color: #718096;">IP ADDRESS:</td>
        <td style="padding: 6px 0; font-family: monospace; color: #1a202c;">${ipAddress}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 700; color: #718096;">TIMESTAMP:</td>
        <td style="padding: 6px 0; color: #1a202c;">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} (IST)</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 700; color: #718096; vertical-align: top;">USER AGENT:</td>
        <td style="padding: 6px 0; color: #4a5568; font-size: 11px;">${userAgent}</td>
      </tr>
    </table>
  </div>
  
  <p style="color: #4a5568; font-size: 13px; line-height: 1.5; margin-bottom: 24px; text-align: center;">
    A request to log in to the LEGATRIXON Admin Console has been initiated. Please verify the request details above and authorize or reject access.
  </p>

  <p style="color: #b58920; font-size: 12px; line-height: 1.5; margin-bottom: 10px; text-align: center; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
    Option 1: If approving from Mobile Phone (on same Wi-Fi network)
  </p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" width="180" bgcolor="#d97706" style="border-radius: 8px;">
              <a href="${approveUrlIp}" target="_blank" style="display: inline-block; padding: 12px 18px; color: #ffffff; text-decoration: none; font-weight: 800; font-family: sans-serif; font-size: 11px; border: 1px solid #d97706; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em;">APPROVE (MOBILE/WI-FI)</a>
            </td>
            <td width="15"></td>
            <td align="center" width="180" bgcolor="#dc2626" style="border-radius: 8px;">
              <a href="${rejectUrlIp}" target="_blank" style="display: inline-block; padding: 12px 18px; color: #ffffff; text-decoration: none; font-weight: 800; font-family: sans-serif; font-size: 11px; border: 1px solid #dc2626; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em;">REJECT (MOBILE/WI-FI)</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <p style="color: #b58920; font-size: 12px; line-height: 1.5; margin-bottom: 10px; text-align: center; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
    Option 2: If approving from the same PC (Localhost)
  </p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" width="180" bgcolor="#d97706" style="border-radius: 8px;">
              <a href="${approveUrlLocalhost}" target="_blank" style="display: inline-block; padding: 12px 18px; color: #ffffff; text-decoration: none; font-weight: 800; font-family: sans-serif; font-size: 11px; border: 1px solid #d97706; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em;">APPROVE (SAME PC)</a>
            </td>
            <td width="15"></td>
            <td align="center" width="180" bgcolor="#dc2626" style="border-radius: 8px;">
              <a href="${rejectUrlLocalhost}" target="_blank" style="display: inline-block; padding: 12px 18px; color: #ffffff; text-decoration: none; font-weight: 800; font-family: sans-serif; font-size: 11px; border: 1px solid #dc2626; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em;">REJECT (SAME PC)</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  
  <div style="text-align: center; font-size: 11px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 16px; line-height: 1.4;">
    <strong>Security Warning:</strong> If you did not initiate this login request, please click <strong>REJECT</strong> immediately and consider changing the administrative password.
  </div>
</div>
`;
        const rawMessage = [
            `From: ${from}`,
            `To: ${recipients.join(', ')}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            htmlBody,
        ].join('\r\n');
        if (!host || !user || !pass) {
            this.logger.warn('SMTP settings are missing. Cannot send approval email.');
            return;
        }
        await this.sendSmtp({ host, port, user, pass, from, to: recipients, rawMessage });
    }
    async getSettings() {
        let settings = await this.settingsRepo.findOne({ where: {} });
        if (!settings) {
            settings = this.settingsRepo.create(this.defaultSettings());
            await this.settingsRepo.save(settings);
        }
        const recipients = this.resolveRecipients(settings);
        if (recipients.length === 0) {
            settings.primaryEmail = founder_security_entities_1.FOUNDER_DEFAULT_EMAIL;
            await this.settingsRepo.save(settings);
        }
        return settings;
    }
    async updateSettings(payload) {
        const settings = await this.getSettings();
        const primaryEmail = this.cleanEmail(payload.primaryEmail ?? settings.primaryEmail);
        const backupEmails = this.cleanEmailList(payload.backupEmails ?? settings.backupEmails);
        const recipients = this.cleanEmailList([primaryEmail, ...backupEmails]);
        settings.primaryEmail = recipients[0] || founder_security_entities_1.FOUNDER_DEFAULT_EMAIL;
        settings.backupEmails = recipients.filter((email) => email !== settings.primaryEmail);
        settings.enabledAlerts = {
            ...this.defaultEnabledAlerts(),
            ...(settings.enabledAlerts || {}),
            ...(payload.enabledAlerts || {}),
        };
        settings.approvalWorkflows = {
            ...this.defaultApprovalWorkflows(),
            ...(settings.approvalWorkflows || {}),
            ...(payload.approvalWorkflows || {}),
        };
        return this.settingsRepo.save(settings);
    }
    async listEvents(limit = 50) {
        return this.eventRepo.find({
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(limit, 1), 100),
        });
    }
    async recordSecurityEvent(input, options) {
        if (['ADMIN_LOGIN_ATTEMPT', 'ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED'].includes(input.eventType)) {
            this.logger.log(`[FOUNDER SECURITY] Login detected: eventType=${input.eventType}, actorId=${input.actorId || 'unknown'}, actorEmail=${input.actorEmail || 'unknown'}, ip=${input.ipAddress || 'unknown'}`);
        }
        const settings = await this.getSettings();
        const enabledAlerts = { ...this.defaultEnabledAlerts(), ...(settings.enabledAlerts || {}) };
        const recipients = this.resolveRecipients(settings);
        const mustSend = [
            'ADMIN_LOGIN_SUCCESS',
            'ADMIN_LOGIN_FAILED',
            'ACCOUNT_LOCKED',
        ].includes(input.eventType);
        const isEnabled = enabledAlerts[input.eventType] || mustSend;
        const event = this.eventRepo.create({
            eventType: input.eventType,
            title: input.title || this.toHumanLabel(input.eventType),
            message: input.message || this.defaultEventMessage(input.eventType, input),
            actorId: input.actorId || null,
            actorEmail: input.actorEmail || null,
            ipAddress: input.ipAddress || null,
            userAgent: input.userAgent || null,
            metadata: input.metadata || {},
            recipients,
            deliveryStatus: isEnabled ? 'pending' : 'disabled',
        });
        await this.eventRepo.save(event);
        if (isEnabled) {
            this.logger.log(`[FOUNDER SECURITY] Notification queued: eventType=${input.eventType}, recipients=${recipients.join(', ')}`);
        }
        else {
            return event;
        }
        const deliver = async () => {
            try {
                await this.sendImmediateEmail(recipients, event);
                event.deliveryStatus = 'sent';
                event.deliveryError = null;
                this.logger.log(`[FOUNDER SECURITY] Email sent: successfully sent notification for eventType=${event.eventType} to=${recipients.join(', ')}`);
            }
            catch (error) {
                event.deliveryStatus = 'failed';
                event.deliveryError = error.message;
                this.logger.error(`[FOUNDER SECURITY] Email failed: failed to send notification for eventType=${event.eventType} to=${recipients.join(', ')}. Error: ${error.message}`);
            }
            await this.eventRepo.save(event);
        };
        if (options?.waitForDelivery) {
            await deliver();
        }
        else {
            deliver().catch((err) => {
                this.logger.error(`Background delivery task error: ${err.message}`);
            });
        }
        return event;
    }
    defaultSettings() {
        return {
            primaryEmail: founder_security_entities_1.FOUNDER_DEFAULT_EMAIL,
            backupEmails: [],
            enabledAlerts: this.defaultEnabledAlerts(),
            approvalWorkflows: this.defaultApprovalWorkflows(),
        };
    }
    defaultEnabledAlerts() {
        return founder_security_entities_1.FOUNDER_SECURITY_EVENTS.reduce((acc, eventType) => {
            acc[eventType] = true;
            return acc;
        }, {});
    }
    defaultApprovalWorkflows() {
        return {
            newAdminCreation: true,
            roleChanges: true,
            superAdminAccess: true,
            passwordChanges: true,
        };
    }
    resolveRecipients(settings) {
        const recipients = this.cleanEmailList([
            settings.primaryEmail || founder_security_entities_1.FOUNDER_DEFAULT_EMAIL,
            ...(settings.backupEmails || []),
        ]);
        return recipients.length ? recipients : [founder_security_entities_1.FOUNDER_DEFAULT_EMAIL];
    }
    cleanEmail(email) {
        const normalized = String(email || '').trim().toLowerCase();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
    }
    cleanEmailList(emails) {
        return Array.from(new Set((emails || []).map((email) => this.cleanEmail(email)).filter(Boolean)));
    }
    parseUserAgent(ua) {
        ua = ua || '';
        let browser = 'Unknown Browser';
        let device = 'Unknown Device';
        if (ua.includes('Firefox/')) {
            browser = 'Mozilla Firefox';
        }
        else if (ua.includes('Edg/')) {
            browser = 'Microsoft Edge';
        }
        else if (ua.includes('Chrome/')) {
            browser = 'Google Chrome';
        }
        else if (ua.includes('Safari/')) {
            browser = 'Apple Safari';
        }
        else if (ua.includes('MSIE') || ua.includes('Trident/')) {
            browser = 'Internet Explorer';
        }
        if (ua.includes('Windows')) {
            device = 'Windows PC';
        }
        else if (ua.includes('Macintosh') || ua.includes('Mac OS')) {
            device = 'macOS Device';
        }
        else if (ua.includes('Android')) {
            device = 'Android Device';
        }
        else if (ua.includes('iPhone') || ua.includes('iPad')) {
            device = 'iOS Device';
        }
        else if (ua.includes('Linux')) {
            device = 'Linux System';
        }
        return { browser, device };
    }
    async sendImmediateEmail(recipients, event) {
        if (recipients.length === 0)
            throw new Error('Founder security email recipient missing.');
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || 587);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = process.env.SECURITY_EMAIL_FROM || user || founder_security_entities_1.FOUNDER_DEFAULT_EMAIL;
        const subject = `[LEGATRIXON SECURITY] ${event.title}`;
        const { browser, device } = this.parseUserAgent(event.userAgent);
        const isLockOrFailure = ['ADMIN_LOGIN_FAILED', 'ACCOUNT_LOCKED'].includes(event.eventType);
        const headerColor = isLockOrFailure ? '#dc2626' : '#b58920';
        const alertLabel = isLockOrFailure ? 'SECURITY EVENT ALERT (HIGH PRIORITY)' : 'SECURITY EVENT ALERT';
        const role = event.metadata?.role || (event.message.includes('CTO') ? 'CTO' : event.message.includes('Developer') ? 'Developer' : 'Founder');
        let result = 'Unknown';
        if (event.eventType === 'ADMIN_LOGIN_SUCCESS') {
            result = 'Successful Login';
        }
        else if (event.eventType === 'ACCOUNT_LOCKED') {
            result = 'Account Locked (48 Hours)';
        }
        else if (event.eventType === 'ADMIN_LOGIN_FAILED') {
            if (event.message.toLowerCase().includes('security question') || event.metadata?.failedSecurityQuestion) {
                result = 'Failed Security Question';
            }
            else if (event.message.toLowerCase().includes('rejected by founder')) {
                result = 'Rejected by Founder via Email';
            }
            else {
                result = 'Failed Login (Invalid Credentials)';
            }
        }
        const username = event.actorId || event.metadata?.adminId || 'unknown';
        const time = new Date(event.createdAt || Date.now()).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' (IST)';
        const htmlBody = `
<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background-color: #0f172a; border-radius: 16px; border: 1px solid #1e293b; color: #f8fafc; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
  <!-- Header -->
  <div style="text-align: center; padding-bottom: 24px; border-bottom: 1px solid #1e293b; margin-bottom: 28px;">
    <span style="display: inline-block; width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); margin-bottom: 12px; box-shadow: 0 4px 10px rgba(217, 119, 6, 0.3);"></span>
    <h2 style="margin: 0; color: #f8fafc; font-size: 20px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">LEGATRIXON Admin Shield</h2>
    <p style="color: ${headerColor}; margin: 6px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">${alertLabel}</p>
  </div>

  <!-- Content Card -->
  <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
    <h3 style="margin-top: 0; margin-bottom: 16px; color: #f8fafc; font-size: 15px; font-weight: 700; border-left: 3px solid ${headerColor}; padding-left: 10px;">${event.title}</h3>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #cbd5e1; line-height: 1.8;">
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8; width: 120px;">ROLE:</td>
        <td style="padding: 6px 0; font-weight: 700; color: #f8fafc;">${role}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">USERNAME:</td>
        <td style="padding: 6px 0; font-weight: 700; color: #f8fafc;">${username}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">IP ADDRESS:</td>
        <td style="padding: 6px 0; font-family: 'Courier New', monospace; font-weight: 700; color: #fbbf24;">${event.ipAddress || 'Internal'}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">DEVICE / OS:</td>
        <td style="padding: 6px 0; color: #f8fafc;">${device}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">BROWSER:</td>
        <td style="padding: 6px 0; color: #f8fafc;">${browser}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">TIME:</td>
        <td style="padding: 6px 0; color: #f8fafc;">${time}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #94a3b8;">RESULT:</td>
        <td style="padding: 6px 0; font-weight: 800; color: ${isLockOrFailure ? '#f43f5e' : '#10b981'};">${result}</td>
      </tr>
    </table>
  </div>

  <!-- Description -->
  <div style="background: #1e293b; border-radius: 8px; padding: 16px; border: 1px solid #334155; margin-bottom: 28px;">
    <p style="margin: 0; color: #e2e8f0; font-size: 13px; line-height: 1.6;">
      ${event.message}
    </p>
  </div>

  <!-- Footer -->
  <div style="text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 20px; line-height: 1.5;">
    <strong>Security Warning:</strong> This notification is part of the LEGATRIXON Core Role-Based Security system. If you did not perform this action, please lock the admin console immediately and change credentials.
  </div>
</div>
`;
        const rawMessage = [
            `From: ${from}`,
            `To: ${recipients.join(', ')}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            htmlBody,
        ].join('\r\n');
        if (!host || !user || !pass) {
            this.logger.warn('SMTP settings are missing. Displaying raw email contents for local/dev validation:');
            this.logger.warn(`=================== SECURITY NOTIFICATION EMAIL ===================`);
            this.logger.warn(`TO: ${recipients.join(', ')}`);
            this.logger.warn(`SUBJECT: ${subject}`);
            this.logger.warn(`BODY:\n${event.message}`);
            this.logger.warn(`===================================================================`);
            if (process.env.NODE_ENV !== 'production') {
                this.logger.log('SMTP missing in development. Simulating successful dispatch.');
                return;
            }
            throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS are required for real-time founder security email delivery.');
        }
        await this.sendSmtp({ host, port, user, pass, from, to: recipients, rawMessage });
    }
    sendSmtp(config) {
        return new Promise((resolve, reject) => {
            const secure = config.port === 465;
            const socket = secure
                ? tls.connect(config.port, config.host, { servername: config.host })
                : net.connect(config.port, config.host);
            let buffer = '';
            let step = 0;
            let settled = false;
            let tlsActive = secure;
            let upgradedSocket = null;
            let lastSmtpResponse = '';
            const fail = (error) => {
                if (settled)
                    return;
                settled = true;
                socket.destroy();
                if (upgradedSocket)
                    upgradedSocket.destroy();
                reject(error);
            };
            const send = (line) => {
                const activeSock = upgradedSocket || socket;
                const isBase64Secret = /^[a-zA-Z0-9+/=]+$/.test(line) && line.length > 10;
                const logLine = line.startsWith('AUTH') || isBase64Secret ? '***' : line;
                this.logger.log(`SMTP Client Command: ${logLine}`);
                activeSock.write(`${line}\r\n`);
            };
            const getExpectedCode = (currentStep, isTls) => {
                if (currentStep === 0)
                    return ['220'];
                if (currentStep === 1)
                    return ['250'];
                if (currentStep === 2)
                    return isTls ? ['334'] : ['220'];
                if (currentStep === 3)
                    return ['334'];
                if (currentStep === 4)
                    return ['235'];
                if (currentStep === 5)
                    return ['250'];
                const recipientIndex = currentStep - 6;
                if (recipientIndex < config.to.length - 1) {
                    return ['250'];
                }
                else if (recipientIndex === config.to.length - 1) {
                    return ['250'];
                }
                else if (recipientIndex === config.to.length) {
                    return ['354'];
                }
                else if (recipientIndex === config.to.length + 1) {
                    return ['250'];
                }
                else {
                    return ['221'];
                }
            };
            const continueFlow = (line) => {
                const code = line.slice(0, 3);
                const expected = getExpectedCode(step, tlsActive);
                if (!expected.includes(code)) {
                    return fail(new Error(`SMTP error at step ${step} (TLS active: ${tlsActive}): expected ${expected.join('/')}, got response: ${line}`));
                }
                const currentStep = step;
                step++;
                switch (currentStep) {
                    case 0:
                        send(`EHLO ${config.host}`);
                        break;
                    case 1:
                        if (tlsActive) {
                            send(`AUTH LOGIN`);
                        }
                        else {
                            send('STARTTLS');
                        }
                        break;
                    case 2:
                        if (tlsActive) {
                            send(Buffer.from(config.user).toString('base64'));
                        }
                        else {
                            this.logger.log('Upgrading SMTP connection to TLS...');
                            const upgraded = tls.connect({ socket, servername: config.host }, () => {
                                this.logger.log('SMTP TLS handshake completed successfully.');
                                buffer = '';
                                tlsActive = true;
                                step = 1;
                                send(`EHLO ${config.host}`);
                            });
                            socket.removeAllListeners('data');
                            upgraded.on('data', onData);
                            upgraded.on('error', fail);
                            upgradedSocket = upgraded;
                            return;
                        }
                        break;
                    case 3:
                        send(Buffer.from(config.pass).toString('base64'));
                        break;
                    case 4:
                        send(`MAIL FROM:<${config.from}>`);
                        break;
                    case 5:
                        send(`RCPT TO:<${config.to[0]}>`);
                        break;
                    default: {
                        const recipientIndex = currentStep - 6;
                        if (recipientIndex < config.to.length - 1) {
                            send(`RCPT TO:<${config.to[recipientIndex + 1]}>`);
                        }
                        else if (recipientIndex === config.to.length - 1) {
                            send('DATA');
                        }
                        else if (recipientIndex === config.to.length) {
                            send(config.rawMessage + '\r\n.');
                        }
                        else {
                            send('QUIT');
                            if (!settled) {
                                settled = true;
                                this.logger.log(`SMTP Email Sent. Success Response from server: ${lastSmtpResponse}`);
                                resolve();
                            }
                        }
                    }
                }
            };
            const onData = (data) => {
                buffer += data.toString('utf8');
                const lines = buffer.split(/\r?\n/).filter(Boolean);
                const last = lines[lines.length - 1];
                if (!last || /^\d{3}-/.test(last))
                    return;
                buffer = '';
                lastSmtpResponse = last;
                this.logger.log(`SMTP Server Response: ${last}`);
                continueFlow(last);
            };
            socket.setTimeout(15000, () => fail(new Error('SMTP delivery timed out.')));
            socket.on('data', onData);
            socket.on('error', fail);
        });
    }
    toHumanLabel(eventType) {
        return eventType
            .toLowerCase()
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
    defaultEventMessage(eventType, input) {
        return `${this.toHumanLabel(eventType)} detected for ${input.actorEmail || 'unknown actor'} from ${input.ipAddress || 'unknown IP address'}.`;
    }
    async getAdminAnalytics() {
        const metrics = {
            usersCount: 0,
            eventsCount: 0,
            internshipsCount: 0,
            researchCount: 0,
            mootActivitiesCount: 0,
            flashcardsCount: 0,
            studyHoursCount: 0,
            notificationsCount: 0,
        };
        try {
            const usersRes = await this.dataSource.query('SELECT COUNT(*) as count FROM users');
            metrics.usersCount = parseInt(usersRes[0]?.count ?? usersRes[0]?.COUNT ?? '0', 10);
        }
        catch (e) {
            this.logger.warn(`Failed to count users: ${e.message}`);
        }
        try {
            const eventsRes = await this.dataSource.query('SELECT COUNT(*) as count FROM calendar_events');
            metrics.eventsCount = parseInt(eventsRes[0]?.count ?? eventsRes[0]?.COUNT ?? '0', 10);
        }
        catch (e) {
            this.logger.warn(`Failed to count calendar events: ${e.message}`);
        }
        try {
            const internshipsRes = await this.dataSource.query('SELECT COUNT(*) as count FROM internship_applications');
            metrics.internshipsCount = parseInt(internshipsRes[0]?.count ?? internshipsRes[0]?.COUNT ?? '0', 10);
        }
        catch (e) {
            this.logger.warn(`Failed to count internships: ${e.message}`);
        }
        try {
            const researchRes = await this.dataSource.query('SELECT COUNT(*) as count FROM research_queries');
            metrics.researchCount = parseInt(researchRes[0]?.count ?? researchRes[0]?.COUNT ?? '0', 10);
        }
        catch (e) {
            this.logger.warn(`Failed to count research queries: ${e.message}`);
        }
        try {
            const mootEventsRes = await this.dataSource.query("SELECT COUNT(*) as count FROM calendar_events WHERE event_type = 'moot'");
            const mootEventsCount = parseInt(mootEventsRes[0]?.count ?? mootEventsRes[0]?.COUNT ?? '0', 10);
            const mootHabitRes = await this.dataSource.query("SELECT COALESCE(SUM(moot_preparation), 0) as total FROM academic_habit_logs");
            const mootHabitCount = parseInt(mootHabitRes[0]?.total ?? mootHabitRes[0]?.TOTAL ?? '0', 10);
            metrics.mootActivitiesCount = mootEventsCount + mootHabitCount;
        }
        catch (e) {
            this.logger.warn(`Failed to compute moot activities: ${e.message}`);
        }
        try {
            const flashcardsRes = await this.dataSource.query('SELECT COUNT(*) as count FROM ai_flashcard_reviews');
            const flashcardsReviewsCount = parseInt(flashcardsRes[0]?.count ?? flashcardsRes[0]?.COUNT ?? '0', 10);
            const flashcardsHabitRes = await this.dataSource.query("SELECT COALESCE(SUM(flashcard_revision), 0) as total FROM academic_habit_logs");
            const flashcardsHabitCount = parseInt(flashcardsHabitRes[0]?.total ?? flashcardsHabitRes[0]?.TOTAL ?? '0', 10);
            metrics.flashcardsCount = flashcardsReviewsCount + flashcardsHabitCount;
        }
        catch (e) {
            this.logger.warn(`Failed to compute flashcards reviewed: ${e.message}`);
        }
        try {
            const studyHoursRes = await this.dataSource.query('SELECT COALESCE(SUM(study_hours), 0) as total FROM academic_habit_logs');
            metrics.studyHoursCount = parseFloat(studyHoursRes[0]?.total ?? studyHoursRes[0]?.TOTAL ?? '0');
        }
        catch (e) {
            this.logger.warn(`Failed to sum study hours: ${e.message}`);
        }
        try {
            const notificationsRes = await this.dataSource.query('SELECT COUNT(*) as count FROM notifications');
            metrics.notificationsCount = parseInt(notificationsRes[0]?.count ?? notificationsRes[0]?.COUNT ?? '0', 10);
        }
        catch (e) {
            this.logger.warn(`Failed to count notifications: ${e.message}`);
        }
        return metrics;
    }
};
exports.FounderSecurityService = FounderSecurityService;
exports.FounderSecurityService = FounderSecurityService = FounderSecurityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(founder_security_entities_1.FounderSecuritySettings)),
    __param(1, (0, typeorm_1.InjectRepository)(founder_security_entities_1.FounderSecurityEvent)),
    __param(2, (0, typeorm_1.InjectRepository)(founder_security_entities_1.AdminAccountLock)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], FounderSecurityService);
//# sourceMappingURL=founder-security.service.js.map