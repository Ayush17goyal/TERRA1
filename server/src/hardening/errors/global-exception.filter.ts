import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { AppError } from './app-errors';
import { errorToLog, type AppLogger } from '../logging/logger';
import { reportError } from '../observability/telemetry';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const correlationId = request.correlationId;
    const isHttp = exception instanceof HttpException;
    const isApp = exception instanceof AppError;
    const status = isApp ? exception.statusCode : isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : undefined;
    const defaultMessage = status >= 500 ? 'Something went wrong. Please try again.' : 'The request could not be processed.';
    const message = isApp ? exception.safeMessage : typeof payload === 'object' && payload && 'message' in payload ? (payload as any).message : defaultMessage;
    this.logger.error({ correlationId, status, path: request.path, method: request.method, error: errorToLog(exception) }, 'Request failed');
    if (status >= 500) reportError(exception, { request: { path: request.path, method: request.method, correlationId } });
    response.status(status).json({ error: isApp ? exception.code : isHttp ? 'REQUEST_FAILED' : 'INTERNAL_ERROR', message, correlationId, retryable: isApp ? exception.retryable : status >= 500 });
  }
}