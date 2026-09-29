import type { NextFunction, Request, Response } from 'express';
export declare const CORRELATION_HEADER = "x-correlation-id";
export declare function correlationMiddleware(req: Request & {
    correlationId?: string;
}, res: Response, next: NextFunction): void;
