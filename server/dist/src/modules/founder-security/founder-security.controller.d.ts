import { FounderSecurityEventType } from './founder-security.entities';
import { FounderSecurityService } from './founder-security.service';
export declare class FounderSecurityController {
    private readonly founderSecurityService;
    constructor(founderSecurityService: FounderSecurityService);
    private getClientOrigin;
    getSettings(): Promise<import("./founder-security.entities").FounderSecuritySettings>;
    getAdminAnalytics(): Promise<{
        usersCount: number;
        eventsCount: number;
        internshipsCount: number;
        researchCount: number;
        mootActivitiesCount: number;
        flashcardsCount: number;
        studyHoursCount: number;
        notificationsCount: number;
    }>;
    updateSettings(body: any): Promise<import("./founder-security.entities").FounderSecuritySettings>;
    listEvents(): Promise<import("./founder-security.entities").FounderSecurityEvent[]>;
    recordEvent(req: any, body: {
        eventType: FounderSecurityEventType;
        title?: string;
        message?: string;
        actorId?: string;
        actorEmail?: string;
        metadata?: Record<string, any>;
    }): Promise<import("./founder-security.entities").FounderSecurityEvent>;
    clearLocks(): Promise<{
        success: boolean;
    }>;
    adminLogin(req: any, body: {
        role: string;
        adminId: string;
        password: string;
    }): Promise<{
        ok: boolean;
        message: string;
        locked?: undefined;
        step2Required?: undefined;
        pendingApproval?: undefined;
        token?: undefined;
    } | {
        ok: boolean;
        locked: boolean;
        message: string;
        step2Required?: undefined;
        pendingApproval?: undefined;
        token?: undefined;
    } | {
        ok: boolean;
        step2Required: boolean;
        pendingApproval: boolean;
        token: string;
        message?: undefined;
        locked?: undefined;
    }>;
    verifyQuestion(req: any, body: {
        sessionToken: string;
        answer: string;
    }): Promise<{
        ok: boolean;
        pendingApproval?: boolean;
        token?: string;
        attemptsRemaining?: number;
        locked?: boolean;
        message?: string;
    }>;
    loginApprove(token: string): Promise<string>;
    loginReject(token: string): Promise<"\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"utf-8\">\n  <title>Invalid Request</title>\n  <style>\n    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }\n    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }\n    .icon { font-size: 56px; color: #f43f5e; margin-bottom: 20px; line-height: 1; }\n    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }\n    p { font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6; }\n  </style>\n</head>\n<body>\n  <div class=\"card\">\n    <div class=\"icon\">✖</div>\n    <h1>Invalid or Expired Request</h1>\n    <p>This authorization token has either expired, been processed, or is invalid.</p>\n  </div>\n</body>\n</html>\n      " | "\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"utf-8\">\n  <title>Access Blocked</title>\n  <style>\n    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }\n    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }\n    .icon { font-size: 56px; color: #f43f5e; margin-bottom: 20px; line-height: 1; }\n    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }\n    p { font-size: 14px; color: #94a3b8; margin: 0 0 28px; line-height: 1.6; }\n    .status-badge { display: inline-block; padding: 6px 16px; background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 30px; color: #f43f5e; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }\n  </style>\n</head>\n<body>\n  <div class=\"card\">\n    <div class=\"icon\">✖</div>\n    <h1>Access Blocked</h1>\n    <p>Administrative access to the LEGATRIXON Console has been blocked. This failed login event has been logged for security audit.</p>\n    <span class=\"status-badge\">Rejected</span>\n    <div style=\"font-size: 11px; color: #64748b; margin-top: 28px;\">You can safely close this browser window.</div>\n  </div>\n</body>\n</html>\n      ">;
    loginStatus(token: string): Promise<{
        status: string;
    } | {
        sessionToken?: string;
        status: "rejected" | "pending" | "approved";
    }>;
    getAdminSession(req: any): Promise<{
        authenticated: boolean;
        adminId: any;
        role: any;
        provider: any;
    }>;
    requestClerkAccess(req: any, body: {
        role: string;
        adminId: string;
        answer: string;
    }): Promise<{
        ok: boolean;
        message: string;
        pendingApproval?: undefined;
        token?: undefined;
    } | {
        ok: boolean;
        pendingApproval: boolean;
        token: string;
        message?: undefined;
    }>;
    approveClerkAccess(token: string): Promise<string>;
    rejectClerkAccess(token: string): Promise<"\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"utf-8\">\n  <title>Invalid Request</title>\n  <style>\n    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }\n    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }\n    .icon { font-size: 56px; color: #f43f5e; margin-bottom: 20px; line-height: 1; }\n    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }\n    p { font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.6; }\n  </style>\n</head>\n<body>\n  <div class=\"card\">\n    <div class=\"icon\">✖</div>\n    <h1>Invalid or Expired Request</h1>\n    <p>This authorization token has either expired, been processed, or is invalid.</p>\n  </div>\n</body>\n</html>\n      " | "\n<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"utf-8\">\n  <title>Access Blocked</title>\n  <style>\n    body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }\n    .card { text-align: center; padding: 48px 32px; border-radius: 20px; background: #1e293b; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 100%; box-sizing: border-box; }\n    .icon { font-size: 56px; color: #f43f5e; margin-bottom: 20px; line-height: 1; }\n    h1 { font-size: 24px; margin: 0 0 12px; color: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }\n    p { font-size: 14px; color: #94a3b8; margin: 0 0 28px; line-height: 1.6; }\n    .status-badge { display: inline-block; padding: 6px 16px; background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 30px; color: #f43f5e; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }\n  </style>\n</head>\n<body>\n  <div class=\"card\">\n    <div class=\"icon\">✖</div>\n    <h1>Access Blocked</h1>\n    <p>Clerk Dashboard Access has been blocked. This failed login event has been logged for security audit.</p>\n    <span class=\"status-badge\">Rejected</span>\n    <div style=\"font-size: 11px; color: #64748b; margin-top: 28px;\">You can safely close this browser window.</div>\n  </div>\n</body>\n</html>\n      ">;
    clerkAccessStatus(token: string): Promise<{
        status: string;
    }>;
    clerkAccessSessionCheck(sessionToken: string): Promise<{
        valid: boolean;
        expiresAt?: number;
    }>;
    private getIpAddress;
}
export declare class SecurityTestController {
    private readonly founderSecurityService;
    constructor(founderSecurityService: FounderSecurityService);
    testEmailGet(req: any): Promise<{
        success: boolean;
        error: string;
        message: string;
        deliveryStatus?: undefined;
        timestamp?: undefined;
        stack?: undefined;
    } | {
        success: boolean;
        message: string;
        deliveryStatus: "disabled" | "pending" | "sent";
        timestamp: Date;
        error?: undefined;
        stack?: undefined;
    } | {
        success: boolean;
        error: any;
        stack: any;
        message: string;
        deliveryStatus?: undefined;
        timestamp?: undefined;
    }>;
    testEmailPost(req: any): Promise<{
        success: boolean;
        error: string;
        message: string;
        deliveryStatus?: undefined;
        timestamp?: undefined;
        stack?: undefined;
    } | {
        success: boolean;
        message: string;
        deliveryStatus: "disabled" | "pending" | "sent";
        timestamp: Date;
        error?: undefined;
        stack?: undefined;
    } | {
        success: boolean;
        error: any;
        stack: any;
        message: string;
        deliveryStatus?: undefined;
        timestamp?: undefined;
    }>;
    private sendTestEmail;
    private getIpAddress;
}
