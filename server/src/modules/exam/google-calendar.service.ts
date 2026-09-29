import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { GoogleOAuthToken } from './exam.entities';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SupabaseService } from '../settings/supabase.service';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    @InjectRepository(GoogleOAuthToken)
    private readonly tokenRepository: Repository<GoogleOAuthToken>,
    private readonly supabaseService: SupabaseService,
  ) { }

  /**
   * Store or update Google OAuth tokens for a user
   */
  async saveTokens(userId: string, accessToken: string, refreshToken: string, expiresSec: number) {
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + expiresSec);

    let tokenObj = await this.tokenRepository.findOne({ where: { userId } });
    if (!tokenObj) {
      tokenObj = new GoogleOAuthToken();
      tokenObj.userId = userId;
    }

    tokenObj.googleAccessToken = accessToken;
    if (refreshToken) {
      tokenObj.googleRefreshToken = refreshToken;
    }
    tokenObj.tokenExpiry = expiryDate;

    await this.tokenRepository.save(tokenObj);
    await this.supabaseService.upsertGoogleOAuthToken(userId, {
      google_access_token: accessToken,
      google_refresh_token: refreshToken || tokenObj.googleRefreshToken || null,
      token_expiry: expiryDate.toISOString(),
    });
    this.logger.log(`Google OAuth tokens saved/updated successfully for user ${userId}.`);
  }

  /**
   * Retrieve a valid access token for the user, refreshing it if expired
   */
  async getValidToken(userId: string): Promise<string | null> {
    let tokenObj = await this.tokenRepository.findOne({ where: { userId } });
    if (!tokenObj) {
      const remoteToken = await this.supabaseService.getGoogleOAuthToken(userId);
      if (remoteToken?.google_access_token) {
        tokenObj = this.tokenRepository.create({
          userId,
          googleAccessToken: remoteToken.google_access_token,
          googleRefreshToken: remoteToken.google_refresh_token,
          tokenExpiry: remoteToken.token_expiry ? new Date(remoteToken.token_expiry) : null,
        });
        await this.tokenRepository.save(tokenObj);
      }
    }
    if (!tokenObj) {
      this.logger.warn(`No Google OAuth tokens found for user ${userId}.`);
      return null;
    }

    const now = new Date();
    // Refresh token if it's expired or close to expiring (within 60s)
    if (tokenObj.tokenExpiry && tokenObj.tokenExpiry.getTime() - now.getTime() < 60000) {
      if (!tokenObj.googleRefreshToken) {
        this.logger.warn(`Access token expired for user ${userId} and no refresh token is present.`);
        return tokenObj.googleAccessToken;
      }
      return this.refreshAccessToken(tokenObj);
    }

    return tokenObj.googleAccessToken;
  }

  private async refreshAccessToken(tokenObj: GoogleOAuthToken): Promise<string | null> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      this.logger.warn('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Returning stale access token.');
      return tokenObj.googleAccessToken;
    }

    try {
      this.logger.log(`Refreshing Google access token for user ${tokenObj.userId}...`);
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenObj.googleRefreshToken,
        grant_type: 'refresh_token',
      });

      const { access_token, expires_in } = response.data;
      tokenObj.googleAccessToken = access_token;
      const expiry = new Date();
      expiry.setSeconds(expiry.getSeconds() + expires_in);
      tokenObj.tokenExpiry = expiry;

      await this.tokenRepository.save(tokenObj);
      await this.supabaseService.upsertGoogleOAuthToken(tokenObj.userId, {
        google_access_token: access_token,
        google_refresh_token: tokenObj.googleRefreshToken,
        token_expiry: expiry.toISOString(),
      });
      this.logger.log('Successfully refreshed Google access token.');
      return access_token;
    } catch (error) {
      this.logger.error(`[Google Calendar] Refresh Token Failure: ${error.message}`);
      return tokenObj.googleAccessToken; // Fallback
    }
  }

  /**
   * Sync a local calendar event to Google Calendar
   */
  async createGoogleEvent(
    userId: string,
    event: {
      title: string;
      date: string;
      time: string;
      subject: string;
      description?: string;
      category?: string;
      priority?: string;
      moduleSource?: string;
      eventType?: string;
      reminderMinutes?: number;
    }
  ): Promise<string | null> {
    const token = await this.getValidToken(userId);

    if (!token || token.startsWith('mock_')) {
      this.logger.warn(`[Google Calendar] Skipping sync for "${event.title}" because no valid Google token is connected.`);
      return null;
    }

    try {
      this.logger.log(`Syncing event "${event.title}" to Google Calendar...`);

      const startDateTime = `${event.date}T${event.time}:00`;
      // Default duration: 1 hour
      const endHours = parseInt(event.time.split(':')[0]) + 1;
      const endMinutes = event.time.split(':')[1];
      const endDateTime = `${event.date}T${String(endHours).padStart(2, '0')}:${endMinutes}:00`;

      // Get timezone or fallback
      const timeZone = 'Asia/Kolkata';

      // Color mapping:
      // Exam = Red (11), Revision = Gold (5), Research = Blue (9), Moot Court = Purple (3), Internship = Green (10)
      let colorId: string | undefined = undefined;
      const cat = (event.category || event.eventType || '').toLowerCase();
      if (cat.includes('exam')) {
        colorId = '11';
      } else if (cat.includes('revision')) {
        colorId = '5';
      } else if (cat.includes('research') || cat.includes('paper')) {
        colorId = '9';
      } else if (cat.includes('moot')) {
        colorId = '3';
      } else if (cat.includes('internship') || cat.includes('intern')) {
        colorId = '10';
      }

      let formattedDescription = event.description || '';
      if (event.priority || event.moduleSource) {
        formattedDescription += `\n\n---`;
        if (event.moduleSource) {
          formattedDescription += `\nModule Source: ${event.moduleSource}`;
        }
        if (event.priority) {
          formattedDescription += `\nPriority: ${event.priority}`;
        }
        formattedDescription += `\nLEGATRIXON Academic Operating System`;
      }

      const response = await axios.post(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          summary: event.title,
          description: formattedDescription,
          colorId,
          start: {
            dateTime: startDateTime,
            timeZone,
          },
          end: {
            dateTime: endDateTime,
            timeZone,
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: event.reminderMinutes || 1440 },
              { method: 'popup', minutes: 30 },   // Push popup notification 30 minutes before
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const googleEventId = response.data.id;
      this.logger.log(`[Google Calendar] Calendar Write Success: Created event "${event.title}" on ${event.date} at ${event.time}. Google Event ID: ${googleEventId}`);
      return googleEventId;
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(`[Google Calendar] Calendar Write Failure: ${errorMsg}`);
      
      // Handle unauthorized/revoked credentials by clearing token
      const statusCode = error.response?.status;
      if (statusCode === 401 || statusCode === 403 || error.response?.data?.error === 'invalid_grant') {
        this.logger.warn(`Credentials revoked or invalid for user ${userId}. Deleting cached Google tokens.`);
        await this.tokenRepository.delete({ userId });
        await this.supabaseService.deleteGoogleOAuthToken(userId);
      }

      return null;
    }
  }

  /**
   * Update an existing event in Google Calendar
   */
  async updateGoogleEvent(
    userId: string,
    googleEventId: string,
    event: {
      title: string;
      date: string;
      time: string;
      subject: string;
      description?: string;
      category?: string;
      priority?: string;
      moduleSource?: string;
      eventType?: string;
    }
  ): Promise<boolean> {
    const token = await this.getValidToken(userId);
    if (!token || token.startsWith('mock_')) {
      this.logger.log(`[Google Calendar Sync Mock] Updated event ${googleEventId}: "${event.title}"`);
      return true;
    }

    try {
      const startDateTime = `${event.date}T${event.time}:00`;
      const endHours = parseInt(event.time.split(':')[0]) + 1;
      const endMinutes = event.time.split(':')[1];
      const endDateTime = `${event.date}T${String(endHours).padStart(2, '0')}:${endMinutes}:00`;
      const timeZone = 'Asia/Kolkata';

      let colorId: string | undefined = undefined;
      const cat = (event.category || event.eventType || '').toLowerCase();
      if (cat.includes('exam')) {
        colorId = '11';
      } else if (cat.includes('revision')) {
        colorId = '5';
      } else if (cat.includes('research') || cat.includes('paper')) {
        colorId = '9';
      } else if (cat.includes('moot')) {
        colorId = '3';
      } else if (cat.includes('internship') || cat.includes('intern')) {
        colorId = '10';
      }

      let formattedDescription = event.description || '';
      if (event.priority || event.moduleSource) {
        formattedDescription += `\n\n---`;
        if (event.moduleSource) {
          formattedDescription += `\nModule Source: ${event.moduleSource}`;
        }
        if (event.priority) {
          formattedDescription += `\nPriority: ${event.priority}`;
        }
        formattedDescription += `\nLEGATRIXON Academic Operating System`;
      }

      await axios.patch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          summary: event.title,
          description: formattedDescription,
          colorId,
          start: {
            dateTime: startDateTime,
            timeZone,
          },
          end: {
            dateTime: endDateTime,
            timeZone,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      this.logger.log(`[Google Calendar] Calendar Write Success: Updated event ${googleEventId}: "${event.title}"`);
      return true;
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(`[Google Calendar] Calendar Write Failure: ${errorMsg}`);
      
      const statusCode = error.response?.status;
      if (statusCode === 401 || statusCode === 403 || error.response?.data?.error === 'invalid_grant') {
        this.logger.warn(`Credentials revoked or invalid for user ${userId}. Deleting cached Google tokens.`);
        await this.tokenRepository.delete({ userId });
        await this.supabaseService.deleteGoogleOAuthToken(userId);
      }
      return false;
    }
  }

  /**
   * Delete an event from Google Calendar
   */
  async deleteGoogleEvent(userId: string, googleEventId: string): Promise<boolean> {
    const token = await this.getValidToken(userId);
    if (!token || token.startsWith('mock_')) {
      this.logger.log(`[Google Calendar Sync Mock] Deleted event ${googleEventId}`);
      return true;
    }

    try {
      await axios.delete(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      this.logger.log(`[Google Calendar] Calendar Write Success: Deleted event ${googleEventId}`);
      return true;
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      this.logger.error(`[Google Calendar] Calendar Write Failure: ${errorMsg}`);
      
      const statusCode = error.response?.status;
      if (statusCode === 401 || statusCode === 403 || error.response?.data?.error === 'invalid_grant') {
        this.logger.warn(`Credentials revoked or invalid for user ${userId}. Deleting cached Google tokens.`);
        await this.tokenRepository.delete({ userId });
        await this.supabaseService.deleteGoogleOAuthToken(userId);
      }
      return false;
    }
  }
}
