import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user || {};
    const email = String(user.email || '').toLowerCase();
    const role = String(user.trustedRole || '').toLowerCase();
    const allowedEmails = this.allowedAdminEmails();

    if (
      allowedEmails.has(email) ||
      role === 'admin' ||
      role === 'super_admin' ||
      role === 'founder' ||
      role === 'cto' ||
      role === 'developer'
    ) {
      return true;
    }

    throw new ForbiddenException('Administrative access required.');
  }

  private allowedAdminEmails(): Set<string> {
    const configured = (process.env.ADMIN_EMAILS || process.env.FOUNDER_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    return new Set(configured);
  }
}
