import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_HEADER = 'x-correlation-id';

export function correlationMiddleware(req: Request & { correlationId?: string }, res: Response, next: NextFunction) {
  const inbound = req.header(CORRELATION_HEADER);
  const correlationId = inbound && /^[a-zA-Z0-9._:-]{8,128}$/.test(inbound) ? inbound : randomUUID();
  req.correlationId = correlationId;
  res.setHeader(CORRELATION_HEADER, correlationId);
  next();
}