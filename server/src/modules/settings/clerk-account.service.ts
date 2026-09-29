import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';

@Injectable()
export class ClerkAccountService {
  private get client() {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new ServiceUnavailableException('Clerk is not configured');
    }
    return createClerkClient({ secretKey });
  }

  async getSecurity(userId: string) {
    const [user, response] = await Promise.all([
      this.client.users.getUser(userId),
      this.client.sessions.getSessionList({ userId, limit: 100 }),
    ]);
    const sessions = response.data.filter((session) => session.status === 'active');

    return {
      clerkConnected: true,
      activeSessionsAvailable: true,
      activeSessions: sessions.length,
      deviceHistoryAvailable: true,
      deviceHistory: sessions.map((session: any) => ({
        sessionId: session.id,
        device: [
          session.latestActivity?.browserName,
          session.latestActivity?.deviceType,
        ].filter(Boolean).join(' on ') || 'Unknown device',
        location: [
          session.latestActivity?.city,
          session.latestActivity?.country,
        ].filter(Boolean).join(', ') || null,
        lastSeen: session.lastActiveAt || session.updatedAt || session.createdAt,
      })),
      passwordStatus: user.passwordEnabled ? 'Password enabled' : 'No password configured',
      twoFactorStatus: user.twoFactorEnabled ? 'Enabled' : 'Not enabled',
    };
  }

  async revokeAllSessions(userId: string) {
    const response = await this.client.sessions.getSessionList({ userId, limit: 100 });
    const activeSessions = response.data.filter((session) => session.status === 'active');
    await Promise.all(activeSessions.map((session) => this.client.sessions.revokeSession(session.id)));
    return activeSessions.length;
  }

  async deleteUser(userId: string) {
    await this.client.users.deleteUser(userId);
  }

  async getUser(userId: string) {
    return this.client.users.getUser(userId);
  }

  async updateClerkUser(userId: string, data: { fullName?: string; phoneNumber?: string; university?: string; yearOfStudy?: string }) {
    const updateData: any = {};
    if (data.fullName) {
      updateData.firstName = data.fullName;
    }
    updateData.unsafeMetadata = {
      phone: data.phoneNumber || '',
      collegeName: data.university || '',
      yearOfStudy: data.yearOfStudy || '',
    };
    updateData.publicMetadata = {
      university: data.university || '',
      yearOfStudy: data.yearOfStudy || '',
    };
    return this.client.users.updateUser(userId, updateData);
  }
}
