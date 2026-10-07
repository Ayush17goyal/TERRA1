"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const command_center_access_guard_1 = require("./command-center-access.guard");
function contextFor(user) {
    return {
        getHandler: () => function handler() { },
        getClass: () => class Controller {
        },
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
    };
}
describe('CommandCenterAccessGuard', () => {
    it('rejects a locked customer with a stable feature error', () => {
        const reflector = { getAllAndOverride: () => false };
        const entitlements = {
            getLegalResearchCommandCenterAccess: () => ({ allowed: false, source: 'locked' }),
        };
        const guard = new command_center_access_guard_1.CommandCenterAccessGuard(reflector, entitlements);
        expect(() => guard.canActivate(contextFor({ id: 'customer-1' }))).toThrow(common_1.ForbiddenException);
        try {
            guard.canActivate(contextFor({ id: 'customer-1' }));
        }
        catch (error) {
            expect(error.getResponse()).toMatchObject({ code: 'FEATURE_LOCKED', feature: 'LEGAL_RESEARCH_COMMAND_CENTER' });
        }
    });
    it('allows an authorized account', () => {
        const reflector = { getAllAndOverride: () => false };
        const entitlements = {
            getLegalResearchCommandCenterAccess: () => ({ allowed: true, source: 'explicit_entitlement' }),
        };
        const guard = new command_center_access_guard_1.CommandCenterAccessGuard(reflector, entitlements);
        expect(guard.canActivate(contextFor({ id: 'developer-1' }))).toBe(true);
    });
    it('allows an explicitly shared non-Command-Center endpoint', () => {
        const reflector = { getAllAndOverride: () => true };
        const entitlements = { getLegalResearchCommandCenterAccess: jest.fn() };
        const guard = new command_center_access_guard_1.CommandCenterAccessGuard(reflector, entitlements);
        expect(guard.canActivate(contextFor({ id: 'customer-1' }))).toBe(true);
        expect(entitlements.getLegalResearchCommandCenterAccess).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=command-center-access.guard.spec.js.map