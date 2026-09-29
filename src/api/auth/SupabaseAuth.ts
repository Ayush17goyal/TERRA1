import { ApiError } from '../errors/ApiError';
import type { ApiUser, SupabaseAuthClient } from '../types';

export class SupabaseAuth {
  private readonly client?: SupabaseAuthClient;

  constructor(client?: SupabaseAuthClient) {
    this.client = client;
  }

  async authenticate(request: Request): Promise<ApiUser> {
    const header = request.headers.get('authorization') ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Bearer token is required.');
    }

    if (!this.client) {
      throw new ApiError(500, 'AUTH_NOT_CONFIGURED', 'Supabase auth client is not configured.');
    }

    const token = match[1];
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data?.user?.id) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired access token.', error);
    }

    const roles = this.extractRoles(data.user.app_metadata, data.user.user_metadata);
    return {
      id: data.user.id,
      email: data.user.email,
      roles,
      accessToken: token,
    };
  }

  private extractRoles(appMetadata?: Record<string, unknown>, userMetadata?: Record<string, unknown>): string[] {
    const values = [
      appMetadata?.role,
      appMetadata?.roles,
      userMetadata?.role,
      userMetadata?.roles,
      'student',
    ].flat();
    return [...new Set(values.filter((value): value is string => typeof value === 'string'))];
  }
}
