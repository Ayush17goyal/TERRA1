import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminPortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-admin-key'] || '';
    const adminId = process.env.ADMIN_PORTAL_ID;
    const production = process.env.NODE_ENV === 'production';

    if (!production && adminId && key === adminId) {
      return true;
    }

    // Accept only server-authenticated admin users in production.
    const user = request.user || {};
    const email = String(user.email || '').toLowerCase();
    const role = String(user.role || '').toLowerCase();
    const allowed = new Set((process.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean));

    if (allowed.has(email) || ['admin', 'super_admin', 'founder', 'cto', 'developer'].includes(role)) {
      return true;
    }

    throw new ForbiddenException('Administrative access required.');
  }
}
