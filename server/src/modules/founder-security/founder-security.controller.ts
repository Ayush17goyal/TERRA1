import { Body, Controller, Get, Post, Put, Req, UseGuards, Query, Header } from '@nestjs/common';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { AdminRoleGuard } from '../../guards/admin-role.guard';
import { FounderSecurityEventType } from './founder-security.entities';
import { FounderSecurityService } from './founder-security.service';

@Controller('founder-security')
export class FounderSecurityController {
  constructor(private readonly founderSecurityService: FounderSecurityService) {}

  private getClientOrigin() {
    const explicitOrigin = process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS?.split(',')[0];
    const origin = explicitOrigin?.trim().replace(/\/+$/, '');
    if (origin) return origin;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CLIENT_ORIGINS must be configured in production.');
    }
    return 'http://localhost:5173';
  }

  private getRequiredAdminCredential(name: 'ADMIN_PORTAL_ID' | 'ADMIN_PORTAL_PASSWORD', developmentFallback: string) {
    const value = process.env[name];
    if (value) return value;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${name} must be configured in production.`);
    }
    return developmentFallback;
  }

  @Get('settings')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  async getSettings() {
    return this.founderSecurityService.getSettings();
  }

  @Get('admin-analytics')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  async getAdminAnalytics() {
    return this.founderSecurityService.getAdminAnalytics();
  }

  @Put('settings')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  async updateSettings(@Body() body: any) {
    return this.founderSecurityService.updateSettings(body);
  }

  @Get('events')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  async listEvents() {
    return this.founderSecurityService.listEvents();
  }

  @Post('events')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  async recordEvent(
    @Req() req: any,
    @Body() body: {
      eventType: FounderSecurityEventType;
      title?: string;
      message?: string;
      actorId?: string;
      actorEmail?: string;
      metadata?: Record<string, any>;
    },
  ) {
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

  @Get('clear-locks')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  async clearLocks() {
    return this.founderSecurityService.clearAllLocks();
  }

  @Post('admin-login')
  async adminLogin(
    @Req() req: any,
    @Body() body: { role: string; adminId: string; password: string },
  ) {
    const role = String(body.role || '').trim();
    const adminId = String(body.adminId || '').trim();
    const expectedAdminId = this.getRequiredAdminCredential('ADMIN_PORTAL_ID', 'dev-admin-id');
    const expectedPassword = this.getRequiredAdminCredential('ADMIN_PORTAL_PASSWORD', 'dev-admin-password');
    const ipAddress = this.getIpAddress(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';

    if (!role) {
      return { ok: false, message: 'Role selection is required.' };
    }

    // 1. Check account lock status before checking credentials
    const lockCheck = await this.founderSecurityService.isAccountLocked(adminId, role);
    if (lockCheck.locked) {
      const formattedTime = new Date(lockCheck.lockedUntil).toLocaleString();
      return {
        ok: false,
        locked: true,
        message: `This account has been locked due to multiple security failures. Please try again after 48 hours (locked until ${formattedTime}).`
      };
    }

    // 2. Log the attempt event in background
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

    // 3. Validate Credentials
    if (adminId === expectedAdminId && body.password === expectedPassword) {
      const sessionToken = 'login_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      
      this.founderSecurityService.pendingLogins.set(sessionToken, {
        adminId,
        role,
        ipAddress,
        userAgent,
        createdAt: new Date(),
        fails: 0,
      });

      const questions: Record<string, string> = {
        Founder: 'Name the person I hate the most',
        CTO: 'Which K-Drama do you like the most?',
        Developer: 'What is the founding date of LEGATRIXON?',
      };

      return {
        ok: true,
        step2Required: true,
        sessionToken,
        question: questions[role] || 'Please answer the security question.',
      };
    }

    // 4. Failed credentials log
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

  @Post('verify-question')
  async verifyQuestion(
    @Req() req: any,
    @Body() body: { sessionToken: string; answer: string },
  ) {
    const sessionToken = String(body.sessionToken || '').trim();
    const answer = String(body.answer || '').trim();
    return this.founderSecurityService.verifySecurityQuestion(sessionToken, answer);
  }

  @Get('login-approve')
  @Header('Content-Type', 'text/html')
  async loginApprove(@Query('token') token: string) {
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
    } else {
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

  @Get('login-reject')
  @Header('Content-Type', 'text/html')
  async loginReject(@Query('token') token: string) {
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
    } else {
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

  @Get('login-status')
  async loginStatus(@Query('token') token: string) {
    const attempt = this.founderSecurityService.getLoginApprovalStatus(token);
    if (!attempt) {
      return { status: 'invalid' };
    }
    return { status: attempt.status };
  }

  @Post('clerk-access/request')
  async requestClerkAccess(
    @Req() req: any,
    @Body() body: { role: string; adminId: string; answer: string },
  ) {
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

  @Get('clerk-access/approve')
  @Header('Content-Type', 'text/html')
  async approveClerkAccess(@Query('token') token: string) {
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
    } else {
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

  @Get('clerk-access/reject')
  @Header('Content-Type', 'text/html')
  async rejectClerkAccess(@Query('token') token: string) {
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
    } else {
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

  @Get('clerk-access/status')
  async clerkAccessStatus(@Query('token') token: string) {
    const attempt = this.founderSecurityService.getClerkAccessStatus(token);
    if (!attempt) {
      return { status: 'invalid' };
    }
    return { status: attempt.status };
  }

  @Get('clerk-access/session-check')
  async clerkAccessSessionCheck(@Query('sessionToken') sessionToken: string) {
    const result = this.founderSecurityService.checkClerkAccessSession(sessionToken);
    return result;
  }

  private getIpAddress(req: any): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || '';
  }
}

@Controller('api/security')
export class SecurityTestController {
  constructor(private readonly founderSecurityService: FounderSecurityService) {}

  @Get('test-email')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  async testEmailGet(@Req() req: any) {
    return this.sendTestEmail(req);
  }

  @Post('test-email')
  @UseGuards(ClerkAuthGuard, AdminRoleGuard)
  async testEmailPost(@Req() req: any) {
    return this.sendTestEmail(req);
  }

  private async sendTestEmail(req: any) {
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
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
        message: 'Internal error while processing test email'
      };
    }
  }

  private getIpAddress(req: any): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || '';
  }
}
