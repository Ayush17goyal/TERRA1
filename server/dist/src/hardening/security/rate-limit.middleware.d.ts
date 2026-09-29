import type { NextFunction, Request, Response } from 'express';
import type { RuntimeEnvironment } from '../config/environment';
import type { AppLogger } from '../logging/logger';
export declare function createRateLimitMiddleware(env: RuntimeEnvironment, logger: AppLogger): (req: Request & {
    user?: any;
    correlationId?: string;
}, res: Response, next: NextFunction) => void;
