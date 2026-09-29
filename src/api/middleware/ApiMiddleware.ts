import type { z } from 'zod';
import { ApiError } from '../errors/ApiError';
import type { ApiRequestContext, ApiRouteDefinition } from '../types';
import { SupabaseAuth } from '../auth/SupabaseAuth';
import { ApiRateLimiter } from './ApiRateLimiter';
import { assertNotProductionDefault } from '../services/ProductionRuntimeSafety';

export class ApiMiddleware {
  private readonly auth: SupabaseAuth;
  private readonly rateLimiter: ApiRateLimiter;

  constructor(options: { auth?: SupabaseAuth; rateLimiter?: ApiRateLimiter } = {}) {
    assertNotProductionDefault('ApiMiddleware', [
      !options.auth ? 'auth' : '',
      !options.rateLimiter ? 'rateLimiter' : '',
    ].filter(Boolean));
    this.auth = options.auth ?? new SupabaseAuth();
    this.rateLimiter = options.rateLimiter ?? new ApiRateLimiter();
  }

  createContext(request: Request, route: ApiRouteDefinition, params: Record<string, string> = {}): ApiRequestContext {
    return {
      requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
      correlationId: request.headers.get('x-correlation-id') ?? crypto.randomUUID(),
      startedAt: Date.now(),
      method: route.method,
      path: route.path,
      params,
    };
  }

  async authenticate(request: Request, route: ApiRouteDefinition, context: ApiRequestContext): Promise<ApiRequestContext> {
    if (!route.requiresAuth) return context;
    const user = await this.auth.authenticate(request);
    return { ...context, user };
  }

  authorize(route: ApiRouteDefinition, context: ApiRequestContext): void {
    const roles = route.requiredRoles ?? [];
    if (roles.length === 0) return;
    const userRoles = context.user?.roles ?? [];
    if (!roles.some((role) => userRoles.includes(role))) {
      throw new ApiError(403, 'FORBIDDEN', 'You are not authorized to access this resource.');
    }
  }

  rateLimit(context: ApiRequestContext): void {
    this.rateLimiter.check(context.user?.id ?? context.requestId);
  }

  async parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', parsed.error.flatten());
    }
    return parsed.data;
  }
}
