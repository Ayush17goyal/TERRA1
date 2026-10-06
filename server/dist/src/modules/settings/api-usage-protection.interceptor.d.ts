import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { FeatureEntitlementService } from './feature-entitlement.service';
import { DemoFeature } from './subscription-plans';
type ProtectedRoute = {
    method: string;
    pattern: RegExp;
    feature: DemoFeature;
};
export declare const PROTECTED_API_ROUTES: ProtectedRoute[];
export declare class ApiUsageProtectionInterceptor implements NestInterceptor {
    private readonly entitlements;
    constructor(entitlements: FeatureEntitlementService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
    private resolveFeature;
    private handleFailure;
}
export {};
