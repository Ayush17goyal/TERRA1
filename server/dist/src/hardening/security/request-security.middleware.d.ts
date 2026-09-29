import type { NextFunction, Request, Response } from 'express';
import type { RuntimeEnvironment } from '../config/environment';
import type { AppLogger } from '../logging/logger';
export declare function createRequestSecurityMiddleware(env: RuntimeEnvironment, logger: AppLogger): (req: Request & {
    correlationId?: string;
}, res: Response, next: NextFunction) => void;
