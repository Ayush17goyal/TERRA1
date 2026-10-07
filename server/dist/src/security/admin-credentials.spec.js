"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin_portal_guard_1 = require("../guards/admin-portal.guard");
const admin_role_guard_1 = require("../guards/admin-role.guard");
const clerk_auth_guard_1 = require("../guards/clerk-auth.guard");
const founder_security_controller_1 = require("../modules/founder-security/founder-security.controller");
const founder_security_service_1 = require("../modules/founder-security/founder-security.service");
const admin_credentials_1 = require("./admin-credentials");
describe('admin credential recovery flow', () => {
    const previousEnvironment = { ...process.env };
    beforeEach(() => {
        process.env.NODE_ENV = 'test';
        process.env.ADMIN_PORTAL_SESSION_SECRET = 'test-only-admin-session-secret-with-32-chars';
    });
    afterAll(() => {
        process.env = previousEnvironment;
    });
    function contextFor(token) {
        const request = { headers: { authorization: `Bearer ${token}` } };
        const context = {
            switchToHttp: () => ({ getRequest: () => request }),
        };
        return { context, request };
    }
    it('hashes with scrypt and verifies only the matching password', () => {
        const password = 'correct horse battery staple';
        const encodedHash = (0, admin_credentials_1.hashAdminSecret)(password);
        expect(encodedHash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
        expect(encodedHash).not.toContain(password);
        expect((0, admin_credentials_1.verifyAdminSecret)(password, encodedHash)).toBe(true);
        expect((0, admin_credentials_1.verifyAdminSecret)('wrong password value', encodedHash)).toBe(false);
    });
    it('rejects malformed and tampered hashes without throwing', () => {
        expect((0, admin_credentials_1.verifyAdminSecret)('anything', 'not-a-supported-hash')).toBe(false);
        expect((0, admin_credentials_1.verifyAdminSecret)('anything', 'scrypt$zz$11')).toBe(false);
    });
    it('creates a signed, expiring admin session accepted by both authorization guards', async () => {
        const token = (0, admin_credentials_1.issueAdminSessionToken)('LEGATRIXON20', 'Founder');
        const claims = (0, admin_credentials_1.verifyAdminSessionToken)(token);
        expect(claims).toMatchObject({ sub: 'LEGATRIXON20', role: 'founder', aud: 'legatrixon-admin-portal' });
        const clerkRequest = contextFor(token);
        await expect(new clerk_auth_guard_1.ClerkAuthGuard().canActivate(clerkRequest.context)).resolves.toBe(true);
        expect(clerkRequest.request.user).toMatchObject({ id: 'LEGATRIXON20', role: 'founder', authProvider: 'admin-portal' });
        const adminRequest = contextFor(token);
        await expect(new admin_portal_guard_1.AdminPortalGuard().canActivate(adminRequest.context)).resolves.toBe(true);
        expect(adminRequest.request.user).toMatchObject({ id: 'LEGATRIXON20', role: 'founder', authProvider: 'admin-portal' });
    });
    it('rejects a tampered or expired admin session', () => {
        const token = (0, admin_credentials_1.issueAdminSessionToken)('LEGATRIXON20', 'Founder');
        expect((0, admin_credentials_1.verifyAdminSessionToken)(`${token}x`)).toBeNull();
        expect((0, admin_credentials_1.verifyAdminSessionToken)((0, admin_credentials_1.issueAdminSessionToken)('LEGATRIXON20', 'Founder', -1))).toBeNull();
    });
    it('does not grant admin rights from an untrusted user-editable role', () => {
        const request = { user: { role: 'admin', trustedRole: null, email: null } };
        const context = { switchToHttp: () => ({ getRequest: () => request }) };
        expect(() => new admin_role_guard_1.AdminRoleGuard().canActivate(context)).toThrow('Administrative access required.');
        request.user.trustedRole = 'admin';
        expect(new admin_role_guard_1.AdminRoleGuard().canActivate(context)).toBe(true);
    });
    it('completes credentials -> login route -> approval -> session -> admin authorization', async () => {
        const password = 'end-to-end test password';
        process.env.ADMIN_PORTAL_ID = 'E2E-ADMIN';
        process.env.ADMIN_PORTAL_PASSWORD_HASH = (0, admin_credentials_1.hashAdminSecret)(password);
        const service = new founder_security_service_1.FounderSecurityService({}, {}, { findOne: jest.fn().mockResolvedValue(null) }, {});
        jest.spyOn(service, 'recordSecurityEvent').mockResolvedValue({});
        service.sendApprovalEmail = jest.fn().mockResolvedValue(undefined);
        const controller = new founder_security_controller_1.FounderSecurityController(service);
        const request = { headers: { 'user-agent': 'Jest' }, ip: '127.0.0.1' };
        const login = await controller.adminLogin(request, {
            role: 'Founder',
            adminId: 'E2E-ADMIN',
            password,
        });
        expect(login).toMatchObject({ ok: true, pendingApproval: true });
        await controller.loginApprove(login.token);
        const status = await controller.loginStatus(login.token);
        expect(status.status).toBe('approved');
        expect('sessionToken' in status && status.sessionToken).toBeTruthy();
        if (!('sessionToken' in status) || !status.sessionToken)
            throw new Error('Approved login did not issue a session token.');
        const authorized = contextFor(status.sessionToken);
        await expect(new admin_portal_guard_1.AdminPortalGuard().canActivate(authorized.context)).resolves.toBe(true);
        expect(await controller.getAdminSession({ user: authorized.request.user })).toEqual({
            authenticated: true,
            adminId: 'E2E-ADMIN',
            role: 'founder',
            provider: 'admin-portal',
        });
    });
});
//# sourceMappingURL=admin-credentials.spec.js.map