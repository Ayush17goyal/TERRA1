import { ApiError, toApiError } from '../errors/ApiError';
import type { ApiErrorResponse, ApiRequestContext, ApiSuccessResponse } from '../types';

export class ResponseFactory {
  static json<T>(context: ApiRequestContext, data: T, status = 200, meta?: Record<string, unknown>): Response {
    const body: ApiSuccessResponse<T> = { ok: true, requestId: context.requestId, data, meta };
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  static error(context: ApiRequestContext, error: unknown): Response {
    const apiError = toApiError(error);
    const body: ApiErrorResponse = {
      ok: false,
      requestId: context.requestId,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
    };
    return new Response(JSON.stringify(body), {
      status: apiError.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  static methodNotAllowed(context: ApiRequestContext): Response {
    return this.error(context, new ApiError(405, 'METHOD_NOT_ALLOWED', 'HTTP method is not allowed for this endpoint.'));
  }
}

