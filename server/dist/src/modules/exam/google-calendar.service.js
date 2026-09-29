"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var GoogleCalendarService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleCalendarService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
const exam_entities_1 = require("./exam.entities");
const typeorm_1 = require("typeorm");
const typeorm_2 = require("@nestjs/typeorm");
const supabase_service_1 = require("../settings/supabase.service");
let GoogleCalendarService = GoogleCalendarService_1 = class GoogleCalendarService {
    constructor(tokenRepository, supabaseService) {
        this.tokenRepository = tokenRepository;
        this.supabaseService = supabaseService;
        this.logger = new common_1.Logger(GoogleCalendarService_1.name);
    }
    async saveTokens(userId, accessToken, refreshToken, expiresSec) {
        const expiryDate = new Date();
        expiryDate.setSeconds(expiryDate.getSeconds() + expiresSec);
        let tokenObj = await this.tokenRepository.findOne({ where: { userId } });
        if (!tokenObj) {
            tokenObj = new exam_entities_1.GoogleOAuthToken();
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
    async getValidToken(userId) {
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
        if (tokenObj.tokenExpiry && tokenObj.tokenExpiry.getTime() - now.getTime() < 60000) {
            if (!tokenObj.googleRefreshToken) {
                this.logger.warn(`Access token expired for user ${userId} and no refresh token is present.`);
                return tokenObj.googleAccessToken;
            }
            return this.refreshAccessToken(tokenObj);
        }
        return tokenObj.googleAccessToken;
    }
    async refreshAccessToken(tokenObj) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            this.logger.warn('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Returning stale access token.');
            return tokenObj.googleAccessToken;
        }
        try {
            this.logger.log(`Refreshing Google access token for user ${tokenObj.userId}...`);
            const response = await axios_1.default.post('https://oauth2.googleapis.com/token', {
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
        }
        catch (error) {
            this.logger.error(`[Google Calendar] Refresh Token Failure: ${error.message}`);
            return tokenObj.googleAccessToken;
        }
    }
    async createGoogleEvent(userId, event) {
        const token = await this.getValidToken(userId);
        if (!token || token.startsWith('mock_')) {
            this.logger.warn(`[Google Calendar] Skipping sync for "${event.title}" because no valid Google token is connected.`);
            return null;
        }
        try {
            this.logger.log(`Syncing event "${event.title}" to Google Calendar...`);
            const startDateTime = `${event.date}T${event.time}:00`;
            const endHours = parseInt(event.time.split(':')[0]) + 1;
            const endMinutes = event.time.split(':')[1];
            const endDateTime = `${event.date}T${String(endHours).padStart(2, '0')}:${endMinutes}:00`;
            const timeZone = 'Asia/Kolkata';
            let colorId = undefined;
            const cat = (event.category || event.eventType || '').toLowerCase();
            if (cat.includes('exam')) {
                colorId = '11';
            }
            else if (cat.includes('revision')) {
                colorId = '5';
            }
            else if (cat.includes('research') || cat.includes('paper')) {
                colorId = '9';
            }
            else if (cat.includes('moot')) {
                colorId = '3';
            }
            else if (cat.includes('internship') || cat.includes('intern')) {
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
            const response = await axios_1.default.post('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
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
                        { method: 'popup', minutes: 30 },
                    ],
                },
            }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            const googleEventId = response.data.id;
            this.logger.log(`[Google Calendar] Calendar Write Success: Created event "${event.title}" on ${event.date} at ${event.time}. Google Event ID: ${googleEventId}`);
            return googleEventId;
        }
        catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            this.logger.error(`[Google Calendar] Calendar Write Failure: ${errorMsg}`);
            const statusCode = error.response?.status;
            if (statusCode === 401 || statusCode === 403 || error.response?.data?.error === 'invalid_grant') {
                this.logger.warn(`Credentials revoked or invalid for user ${userId}. Deleting cached Google tokens.`);
                await this.tokenRepository.delete({ userId });
                await this.supabaseService.deleteGoogleOAuthToken(userId);
            }
            return null;
        }
    }
    async updateGoogleEvent(userId, googleEventId, event) {
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
            let colorId = undefined;
            const cat = (event.category || event.eventType || '').toLowerCase();
            if (cat.includes('exam')) {
                colorId = '11';
            }
            else if (cat.includes('revision')) {
                colorId = '5';
            }
            else if (cat.includes('research') || cat.includes('paper')) {
                colorId = '9';
            }
            else if (cat.includes('moot')) {
                colorId = '3';
            }
            else if (cat.includes('internship') || cat.includes('intern')) {
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
            await axios_1.default.patch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
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
            }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            this.logger.log(`[Google Calendar] Calendar Write Success: Updated event ${googleEventId}: "${event.title}"`);
            return true;
        }
        catch (error) {
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
    async deleteGoogleEvent(userId, googleEventId) {
        const token = await this.getValidToken(userId);
        if (!token || token.startsWith('mock_')) {
            this.logger.log(`[Google Calendar Sync Mock] Deleted event ${googleEventId}`);
            return true;
        }
        try {
            await axios_1.default.delete(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            this.logger.log(`[Google Calendar] Calendar Write Success: Deleted event ${googleEventId}`);
            return true;
        }
        catch (error) {
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
};
exports.GoogleCalendarService = GoogleCalendarService;
exports.GoogleCalendarService = GoogleCalendarService = GoogleCalendarService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_2.InjectRepository)(exam_entities_1.GoogleOAuthToken)),
    __metadata("design:paramtypes", [typeorm_1.Repository,
        supabase_service_1.SupabaseService])
], GoogleCalendarService);
//# sourceMappingURL=google-calendar.service.js.map