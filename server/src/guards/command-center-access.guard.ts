import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureEntitlementService } from '../modules/settings/feature-entitlement.service';

export const ALLOW_WITHOUT_COMMAND_CENTER_ACCESS = 'allowWithoutCommandCenterAccess';

export const AllowWithoutCommandCenterAccess = () => SetMetadata(ALLOW_WITHOUT_COMMAND_CENTER_ACCESS, true);

@Injectable()
export class CommandCenterAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: FeatureEntitlementService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isSharedRoute = this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_COMMAND_CENTER_ACCESS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isSharedRoute) return true;

    const request = context.switchToHttp().getRequest();
    const decision = this.entitlements.getLegalResearchCommandCenterAccess(request.user);
    if (decision.allowed) return true;

    throw new ForbiddenException({
      code: 'FEATURE_LOCKED',
      feature: 'LEGAL_RESEARCH_COMMAND_CENTER',
      message: 'The Legal Research Command Center is not currently available for this account.',
    });
  }
}
