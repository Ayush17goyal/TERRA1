import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class ClerkAuthGuard implements CanActivate {
    private readonly logger;
    canActivate(context: ExecutionContext): Promise<boolean>;
    private toRequestUser;
    private decodeTokenSubject;
    private localFallbackUser;
    private isLocalRequest;
}
