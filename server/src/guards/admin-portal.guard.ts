import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { verifyAdminSessionToken } from '../security/admin-credentials';

@Injectable()
export class AdminPortalGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = String(request.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
    const portalSession = verifyAdminSessionToken(token);
    if (portalSession) {
      request.user = {
        id: portalSession.sub,
        email: null,
        role: portalSession.role,
        trustedRole: portalSession.role,
        authProvider: 'admin-portal',
      };
      return true;
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (token && secretKey) {
      try {
        const claims = await verifyToken(token, { secretKey, clockSkewInMs: 120000 });
        if (claims.sub) {
          const clerk = createClerkClient({ secretKey });
          const clerkUser = await clerk.users.getUser(claims.sub);
          const primaryEmail = clerkUser.emailAddresses.find((item) => item.id === clerkUser.primaryEmailAddressId) || clerkUser.emailAddresses[0];
          request.user = {
            id: clerkUser.id,
            email: primaryEmail?.emailAddress || null,
            role: clerkUser.privateMetadata?.role || clerkUser.publicMetadata?.role || null,
            trustedRole: clerkUser.privateMetadata?.role || clerkUser.publicMetadata?.role || null,
            authProvider: 'clerk',
          };
        }
      } catch {
        // Authorization below deliberately returns one generic error.
      }
    }

    const user = request.user || {};
    const email = String(user.email || '').toLowerCase();
    const role = String(user.trustedRole || user.role || '').toLowerCase();
    const allowed = new Set((process.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));

    if (allowed.has(email) || ['admin', 'super_admin', 'founder', 'cto', 'developer'].includes(role)) {
      return true;
    }

    throw new ForbiddenException('Administrative access required.');
  }
}
