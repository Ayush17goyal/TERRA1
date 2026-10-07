import { ExecutionContext } from '@nestjs/common';
import { AdminPortalGuard } from '../guards/admin-portal.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { ClerkAuthGuard } from '../guards/clerk-auth.guard';
import { FounderSecurityController } from '../modules/founder-security/founder-security.controller';
import { FounderSecurityService } from '../modules/founder-security/founder-security.service';
import {
  hashAdminSecret,
  issueAdminSessionToken,
  verifyAdminSecret,
  verifyAdminSessionToken,
} from './admin-credentials';

describe('admin credential recovery flow', () => {
  const previousEnvironment = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_PORTAL_SESSION_SECRET = 'test-only-admin-session-secret-with-32-chars';
  });

  afterAll(() => {
    process.env = previousEnvironment;
  });

  function contextFor(token: string) {
    const request: any = { headers: { authorization: `Bearer ${token}` } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    return { context, request };
  }

  it('hashes with scrypt and verifies only the matching password', () => {
    const password = 'correct horse battery staple';
    const encodedHash = hashAdminSecret(password);

    expect(encodedHash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(encodedHash).not.toContain(password);
    expect(verifyAdminSecret(password, encodedHash)).toBe(true);
    expect(verifyAdminSecret('wrong password value', encodedHash)).toBe(false);
  });

  it('rejects malformed and tampered hashes without throwing', () => {
    expect(verifyAdminSecret('anything', 'not-a-supported-hash')).toBe(false);
    expect(verifyAdminSecret('anything', 'scrypt$zz$11')).toBe(false);
  });

  it('creates a signed, expiring admin session accepted by both authorization guards', async () => {
    const token = issueAdminSessionToken('LEGATRIXON20', 'Founder');
    const claims = verifyAdminSessionToken(token);
    expect(claims).toMatchObject({ sub: 'LEGATRIXON20', role: 'founder', aud: 'legatrixon-admin-portal' });

    const clerkRequest = contextFor(token);
    await expect(new ClerkAuthGuard().canActivate(clerkRequest.context)).resolves.toBe(true);
    expect(clerkRequest.request.user).toMatchObject({ id: 'LEGATRIXON20', role: 'founder', authProvider: 'admin-portal' });

    const adminRequest = contextFor(token);
    await expect(new AdminPortalGuard().canActivate(adminRequest.context)).resolves.toBe(true);
    expect(adminRequest.request.user).toMatchObject({ id: 'LEGATRIXON20', role: 'founder', authProvider: 'admin-portal' });
  });

  it('rejects a tampered or expired admin session', () => {
    const token = issueAdminSessionToken('LEGATRIXON20', 'Founder');
    expect(verifyAdminSessionToken(`${token}x`)).toBeNull();
    expect(verifyAdminSessionToken(issueAdminSessionToken('LEGATRIXON20', 'Founder', -1))).toBeNull();
  });

  it('does not grant admin rights from an untrusted user-editable role', () => {
    const request: any = { user: { role: 'admin', trustedRole: null, email: null } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
    expect(() => new AdminRoleGuard().canActivate(context)).toThrow('Administrative access required.');

    request.user.trustedRole = 'admin';
    expect(new AdminRoleGuard().canActivate(context)).toBe(true);
  });

  it('completes credentials -> login route -> approval -> session -> admin authorization', async () => {
    const password = 'end-to-end test password';
    process.env.ADMIN_PORTAL_ID = 'E2E-ADMIN';
    process.env.ADMIN_PORTAL_PASSWORD_HASH = hashAdminSecret(password);

    const service = new FounderSecurityService(
      {} as any,
      {} as any,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
    );
    jest.spyOn(service, 'recordSecurityEvent').mockResolvedValue({} as any);
    (service as any).sendApprovalEmail = jest.fn().mockResolvedValue(undefined);
    const controller = new FounderSecurityController(service);
    const request = { headers: { 'user-agent': 'Jest' }, ip: '127.0.0.1' };

    const login = await controller.adminLogin(request, {
      role: 'Founder',
      adminId: 'E2E-ADMIN',
      password,
    });
    expect(login).toMatchObject({ ok: true, pendingApproval: true });

    await controller.loginApprove(login.token!);
    const status = await controller.loginStatus(login.token!);
    expect(status.status).toBe('approved');
    expect('sessionToken' in status && status.sessionToken).toBeTruthy();
    if (!('sessionToken' in status) || !status.sessionToken) throw new Error('Approved login did not issue a session token.');

    const authorized = contextFor(status.sessionToken);
    await expect(new AdminPortalGuard().canActivate(authorized.context)).resolves.toBe(true);
    expect(await controller.getAdminSession({ user: authorized.request.user })).toEqual({
      authenticated: true,
      adminId: 'E2E-ADMIN',
      role: 'founder',
      provider: 'admin-portal',
    });
  });
});
