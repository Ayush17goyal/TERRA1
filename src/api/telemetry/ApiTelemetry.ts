import type { LoggerLike } from '../../llm/types';
import type { ApiRequestContext } from '../types';

class ConsoleApiLogger implements LoggerLike {
  info(data: unknown, message?: string): void { console.info(message ?? 'api.info', data); }
  warn(data: unknown, message?: string): void { console.warn(message ?? 'api.warn', data); }
  error(data: unknown, message?: string): void { console.error(message ?? 'api.error', data); }
  debug(data: unknown, message?: string): void { console.debug(message ?? 'api.debug', data); }
}

export class ApiTelemetry {
  private readonly logger: LoggerLike;

  constructor(logger?: LoggerLike) {
    if (!logger && typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      throw new Error('ApiTelemetry is not production-ready: missing required logger dependency.');
    }
    this.logger = logger ?? new ConsoleApiLogger();
  }

  requestStarted(context: ApiRequestContext): void {
    this.logger.info({ requestId: context.requestId, path: context.path, method: context.method, userId: context.user?.id }, 'api.request_started');
  }

  requestCompleted(context: ApiRequestContext, status: number): void {
    this.logger.info({
      requestId: context.requestId,
      path: context.path,
      status,
      durationMs: Date.now() - context.startedAt,
    }, 'api.request_completed');
  }

  requestFailed(context: ApiRequestContext, error: Error, status: number): void {
    this.logger.error({
      requestId: context.requestId,
      path: context.path,
      status,
      error: error.message,
      durationMs: Date.now() - context.startedAt,
    }, 'api.request_failed');
  }
}
