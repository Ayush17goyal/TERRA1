import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureEntitlementService } from '../modules/settings/feature-entitlement.service';
export declare const ALLOW_WITHOUT_COMMAND_CENTER_ACCESS = "allowWithoutCommandCenterAccess";
export declare const AllowWithoutCommandCenterAccess: () => import("@nestjs/common").CustomDecorator<string>;
export declare class CommandCenterAccessGuard implements CanActivate {
    private readonly reflector;
    private readonly entitlements;
    constructor(reflector: Reflector, entitlements: FeatureEntitlementService);
    canActivate(context: ExecutionContext): boolean;
}
