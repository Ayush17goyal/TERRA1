import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CommandCenterAccessGuard } from './command-center-access.guard';

function contextFor(user: any): any {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
}

describe('CommandCenterAccessGuard', () => {
  it('rejects a locked customer with a stable feature error', () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const entitlements = {
      getLegalResearchCommandCenterAccess: () => ({ allowed: false, source: 'locked' }),
    };
    const guard = new CommandCenterAccessGuard(reflector, entitlements as any);

    expect(() => guard.canActivate(contextFor({ id: 'customer-1' }))).toThrow(ForbiddenException);
    try {
      guard.canActivate(contextFor({ id: 'customer-1' }));
    } catch (error: any) {
      expect(error.getResponse()).toMatchObject({ code: 'FEATURE_LOCKED', feature: 'LEGAL_RESEARCH_COMMAND_CENTER' });
    }
  });

  it('allows an authorized account', () => {
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const entitlements = {
      getLegalResearchCommandCenterAccess: () => ({ allowed: true, source: 'explicit_entitlement' }),
    };
    const guard = new CommandCenterAccessGuard(reflector, entitlements as any);
    expect(guard.canActivate(contextFor({ id: 'developer-1' }))).toBe(true);
  });

  it('allows an explicitly shared non-Command-Center endpoint', () => {
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const entitlements = { getLegalResearchCommandCenterAccess: jest.fn() };
    const guard = new CommandCenterAccessGuard(reflector, entitlements as any);
    expect(guard.canActivate(contextFor({ id: 'customer-1' }))).toBe(true);
    expect(entitlements.getLegalResearchCommandCenterAccess).not.toHaveBeenCalled();
  });
});
