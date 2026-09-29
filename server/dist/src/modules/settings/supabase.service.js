"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SupabaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
let SupabaseService = SupabaseService_1 = class SupabaseService {
    constructor() {
        this.logger = new common_1.Logger(SupabaseService_1.name);
        this.supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
        this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
    isConfigured() {
        if (process.env.SUPABASE_DISABLED === 'true' || process.env.DISABLE_SUPABASE === 'true')
            return false;
        return Boolean(this.supabaseUrl && !/localhost:9|127\.0\.0\.1:9/i.test(this.supabaseUrl));
    }
    getServiceRoleKey() {
        return this.supabaseServiceKey || '';
    }
    getHeaders(userToken) {
        let key = userToken ? this.supabaseAnonKey : (this.supabaseServiceKey || this.supabaseAnonKey);
        if (!userToken && this.supabaseServiceKey) {
            try {
                const urlRef = this.supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
                const keyPayloadB64 = this.supabaseServiceKey.split('.')[1];
                const keyPayload = JSON.parse(Buffer.from(keyPayloadB64, 'base64').toString('utf8'));
                const keyRef = keyPayload.ref;
                if (urlRef && keyRef && urlRef.toLowerCase() !== keyRef.toLowerCase()) {
                    this.logger.warn(`Project ref mismatch: URL is for "${urlRef}" but service key is for "${keyRef}". Falling back to anon key.`);
                    key = this.supabaseAnonKey;
                }
            }
            catch (err) {
                this.logger.warn(`Failed to validate service key project ref: ${err.message}. Falling back to anon key.`);
                key = this.supabaseAnonKey;
            }
        }
        const auth = userToken ? `Bearer ${userToken}` : `Bearer ${key}`;
        return {
            'apikey': key,
            'Authorization': auth,
            'Content-Type': 'application/json',
        };
    }
    async getPreferences(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/user_notification_preferences?user_id=eq.${userId}`, { headers: this.getHeaders(userToken) });
            return response.data[0] || null;
        }
        catch (err) {
            this.logger.warn(`Supabase getPreferences failed: ${err.message}. Fallback active.`);
            return null;
        }
    }
    async upsertPreferences(userId, prefs, userToken) {
        try {
            const payload = { user_id: userId, ...prefs };
            delete payload.id;
            delete payload.created_at;
            delete payload.updated_at;
            delete payload.createdAt;
            delete payload.updatedAt;
            const response = await axios_1.default.post(`${this.supabaseUrl}/rest/v1/user_notification_preferences`, payload, {
                headers: {
                    ...this.getHeaders(userToken),
                    'Prefer': 'resolution=merge-duplicates,return=representation',
                },
            });
            return response.data[0] || null;
        }
        catch (err) {
            this.logger.error(`Supabase upsertPreferences failed: ${err.message}`);
            throw err;
        }
    }
    async getPendingNotifications(userToken) {
        if (!this.isConfigured())
            return null;
        try {
            const now = new Date().toISOString();
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/notifications?email_sent=eq.false&trigger_time=lte.${now}`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getPendingNotifications failed: ${err.message}. Fallback active.`);
            return null;
        }
    }
    async markEmailSent(notificationId, examId, userToken) {
        try {
            const deliveredAt = new Date().toISOString();
            await axios_1.default.patch(`${this.supabaseUrl}/rest/v1/notifications?id=eq.${notificationId}`, {
                email_sent: true,
                delivery_status: 'sent',
                delivered_at: deliveredAt,
                delivery_error: null,
            }, { headers: this.getHeaders(userToken) });
            if (examId) {
                await axios_1.default.patch(`${this.supabaseUrl}/rest/v1/exams?id=eq.${examId}`, { reminder_sent_at: deliveredAt }, { headers: this.getHeaders(userToken) });
            }
        }
        catch (err) {
            this.logger.error(`Supabase markEmailSent failed: ${err.message}`);
        }
    }
    async updateNotificationTriggerTime(notificationId, newTriggerTime, userToken) {
        try {
            await axios_1.default.patch(`${this.supabaseUrl}/rest/v1/notifications?id=eq.${notificationId}`, { trigger_time: newTriggerTime }, { headers: this.getHeaders(userToken) });
        }
        catch (err) {
            this.logger.error(`Supabase updateNotificationTriggerTime failed: ${err.message}`);
        }
    }
    async createNotification(notification, userToken) {
        if (!this.isConfigured())
            return null;
        try {
            const payload = {
                ...notification,
                user: notification.user || notification.user_id,
                sent_at: notification.sent_at || new Date().toISOString(),
                delivery_status: notification.delivery_status || 'sent',
            };
            const response = await axios_1.default.post(`${this.supabaseUrl}/rest/v1/notifications`, payload, { headers: this.getHeaders(userToken) });
            return response.data || null;
        }
        catch (err) {
            this.logger.error(`Supabase createNotification failed: ${err.message}`);
            return null;
        }
    }
    async logDelivery(log, userToken) {
        if (!this.isConfigured())
            return null;
        try {
            const payload = {
                user_id: log.user_id,
                notification_type: log.notification_type || 'alert',
                delivery_method: log.channel || 'all',
                title: log.title,
                message: log.message,
                status: log.status,
                sent_at: new Date().toISOString(),
            };
            await axios_1.default.post(`${this.supabaseUrl}/rest/v1/notification_logs`, payload, { headers: this.getHeaders(userToken) });
            this.logger.log(`Logged notification delivery: status=${payload.status} delivery_method=${payload.delivery_method} user=${payload.user_id}`);
        }
        catch (err) {
            this.logger.error(`Supabase logDelivery failed: ${err.message}`);
        }
    }
    async getUserEmail(userId, userToken) {
        if (!this.isConfigured())
            return null;
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/users?id=eq.${userId}`, { headers: this.getHeaders(userToken) });
            return response.data[0]?.email || null;
        }
        catch (err) {
            this.logger.warn(`Supabase getUserEmail failed: ${err.message}. Fallback active.`);
            return null;
        }
    }
    async getProfile(clerkUserId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/users?clerk_user_id=eq.${clerkUserId}`, { headers: this.getHeaders(userToken) });
            return response.data[0] || null;
        }
        catch (err) {
            this.logger.warn(`Supabase getProfile failed for ${clerkUserId}: ${err.message}`);
            return null;
        }
    }
    async getGoogleOAuthToken(clerkUserId) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/google_oauth_tokens?clerk_user_id=eq.${clerkUserId}`, { headers: this.getHeaders() });
            return response.data[0] || null;
        }
        catch (err) {
            this.logger.warn(`Supabase getGoogleOAuthToken failed: ${err.message}`);
            return null;
        }
    }
    async upsertGoogleOAuthToken(clerkUserId, tokenData) {
        const profile = await this.getProfile(clerkUserId);
        if (!profile?.id)
            return null;
        try {
            const response = await axios_1.default.post(`${this.supabaseUrl}/rest/v1/google_oauth_tokens`, {
                user_id: profile.id,
                clerk_user_id: clerkUserId,
                ...tokenData,
                updated_at: new Date().toISOString(),
            }, {
                headers: {
                    ...this.getHeaders(),
                    'Prefer': 'resolution=merge-duplicates,return=representation',
                },
            });
            return response.data[0] || null;
        }
        catch (err) {
            this.logger.warn(`Supabase upsertGoogleOAuthToken failed: ${err.message}`);
            return null;
        }
    }
    async deleteGoogleOAuthToken(clerkUserId) {
        try {
            await axios_1.default.delete(`${this.supabaseUrl}/rest/v1/google_oauth_tokens?clerk_user_id=eq.${clerkUserId}`, { headers: this.getHeaders() });
        }
        catch (err) {
            this.logger.warn(`Supabase deleteGoogleOAuthToken failed: ${err.message}`);
        }
    }
    async upsertProfile(clerkUserId, profileData, userToken) {
        try {
            const existing = await this.getProfile(clerkUserId, userToken);
            const payload = {
                clerk_user_id: clerkUserId,
                ...profileData,
            };
            if (!existing) {
                payload.role = 'student';
                payload.account_status = 'active';
                payload.joined_date = new Date().toISOString();
                payload.created_at = new Date().toISOString();
            }
            payload.updated_at = new Date().toISOString();
            delete payload.id;
            delete payload.createdAt;
            delete payload.updatedAt;
            const response = await axios_1.default.post(`${this.supabaseUrl}/rest/v1/users`, payload, {
                headers: {
                    ...this.getHeaders(userToken),
                    'Prefer': 'resolution=merge-duplicates,return=representation',
                },
            });
            return response.data[0] || null;
        }
        catch (err) {
            this.logger.error(`Supabase upsertProfile failed: ${err.message}`);
            throw err;
        }
    }
    async logActivity(userId, moduleName, actionType, sessionId, userToken) {
        if (!this.isConfigured())
            return null;
        try {
            const payload = {
                user_id: userId,
                module: moduleName,
                action: actionType,
                module_name: moduleName,
                action_type: actionType,
                session_id: sessionId || null,
                created_at: new Date().toISOString()
            };
            await axios_1.default.post(`${this.supabaseUrl}/rest/v1/user_activity_logs`, payload, { headers: this.getHeaders(userToken) });
        }
        catch (err) {
            this.logger.error(`Supabase logActivity failed: ${err.message}`);
        }
    }
    async getUserActivityLogs(userId, userToken) {
        try {
            const url = userId
                ? `${this.supabaseUrl}/rest/v1/user_activity_logs?user_id=eq.${userId}&order=created_at.desc`
                : `${this.supabaseUrl}/rest/v1/user_activity_logs?order=created_at.desc`;
            const response = await axios_1.default.get(url, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getUserActivityLogs failed: ${err.message}`);
            return [];
        }
    }
    async getCalendarEvents(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/calendar_events?user_id=eq.${userId}&order=event_date.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getCalendarEvents failed: ${err.message}`);
            return [];
        }
    }
    async getResearchHistory(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/research_history?user_id=eq.${userId}&order=created_at.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getResearchHistory failed: ${err.message}`);
            return [];
        }
    }
    async getFlashcards(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/flashcards?user_id=eq.${userId}&order=created_at.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getFlashcards failed: ${err.message}`);
            return [];
        }
    }
    async getQuizResults(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/quiz_results?user_id=eq.${userId}&order=created_at.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getQuizResults failed: ${err.message}`);
            return [];
        }
    }
    async getExports(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/exports?user_id=eq.${userId}&order=downloaded_at.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getExports failed: ${err.message}`);
            return [];
        }
    }
    async logExport(userId, exportType, format, fileName, userToken) {
        try {
            const payload = {
                user_id: userId,
                export_type: exportType,
                format,
                file_name: fileName,
                downloaded_at: new Date().toISOString()
            };
            await axios_1.default.post(`${this.supabaseUrl}/rest/v1/exports`, payload, { headers: this.getHeaders(userToken) });
        }
        catch (err) {
            this.logger.error(`Supabase logExport failed: ${err.message}`);
        }
    }
    async getAllLogins(userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/user_login_logs?order=login_time.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getAllLogins failed: ${err.message}`);
            return [];
        }
    }
    async getUserLogins(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/user_login_logs?user_id=eq.${userId}&order=login_time.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getUserLogins failed: ${err.message}`);
            return [];
        }
    }
    async createRating(userId, email, name, rating, userToken) {
        try {
            const payload = {
                user_id: userId,
                user_email: email,
                user_name: name,
                rating,
                created_at: new Date().toISOString()
            };
            const response = await axios_1.default.post(`${this.supabaseUrl}/rest/v1/feedback_ratings`, payload, {
                headers: {
                    ...this.getHeaders(userToken),
                    'Prefer': 'return=representation'
                }
            });
            const ratingRecord = response.data[0];
            if (ratingRecord) {
                await this.createSupportTicket(userId, email, name, 'Star Rating', ratingRecord.id, 'Submitted', userToken);
            }
            return ratingRecord || null;
        }
        catch (err) {
            this.logger.error(`createRating failed: ${err.message}`);
            return null;
        }
    }
    async createAiFeedback(userId, email, name, feedbackType, userToken) {
        try {
            const payload = {
                user_id: userId,
                user_email: email,
                user_name: name,
                feedback_type: feedbackType,
                created_at: new Date().toISOString()
            };
            const response = await axios_1.default.post(`${this.supabaseUrl}/rest/v1/ai_feedback`, payload, {
                headers: {
                    ...this.getHeaders(userToken),
                    'Prefer': 'return=representation'
                }
            });
            const feedbackRecord = response.data[0];
            if (feedbackRecord) {
                await this.createSupportTicket(userId, email, name, 'AI Feedback', feedbackRecord.id, 'Submitted', userToken);
            }
            return feedbackRecord || null;
        }
        catch (err) {
            this.logger.error(`createAiFeedback failed: ${err.message}`);
            return null;
        }
    }
    async createBugReport(userId, email, name, issueType, moduleName, description, screenshotUrl, userToken) {
        try {
            const payload = {
                user_id: userId,
                user_email: email,
                user_name: name,
                issue_type: issueType,
                module_name: moduleName,
                description,
                screenshot_url: screenshotUrl || null,
                status: 'Open',
                created_at: new Date().toISOString()
            };
            const response = await axios_1.default.post(`${this.supabaseUrl}/rest/v1/bug_reports`, payload, {
                headers: {
                    ...this.getHeaders(userToken),
                    'Prefer': 'return=representation'
                }
            });
            const bugRecord = response.data[0];
            if (bugRecord) {
                await this.createSupportTicket(userId, email, name, 'Bug Report', bugRecord.id, 'Open', userToken);
            }
            return bugRecord || null;
        }
        catch (err) {
            this.logger.error(`createBugReport failed: ${err.message}`);
            return null;
        }
    }
    async createFeatureRequest(userId, email, name, title, description, priority, userToken) {
        try {
            const payload = {
                user_id: userId,
                user_email: email,
                user_name: name,
                title,
                description,
                priority,
                votes: 0,
                status: 'Pending',
                created_at: new Date().toISOString()
            };
            const response = await axios_1.default.post(`${this.supabaseUrl}/rest/v1/feature_requests`, payload, {
                headers: {
                    ...this.getHeaders(userToken),
                    'Prefer': 'return=representation'
                }
            });
            const featureRecord = response.data[0];
            if (featureRecord) {
                await this.createSupportTicket(userId, email, name, 'Feature Request', featureRecord.id, 'Pending', userToken);
            }
            return featureRecord || null;
        }
        catch (err) {
            this.logger.error(`createFeatureRequest failed: ${err.message}`);
            return null;
        }
    }
    async createSupportTicket(userId, email, name, ticketType, referenceId, status, userToken) {
        try {
            const payload = {
                user_id: userId,
                user_email: email,
                user_name: name,
                ticket_type: ticketType,
                reference_id: referenceId,
                status,
                created_at: new Date().toISOString()
            };
            const response = await axios_1.default.post(`${this.supabaseUrl}/rest/v1/support_tickets`, payload, {
                headers: {
                    ...this.getHeaders(userToken),
                    'Prefer': 'return=representation'
                }
            });
            return response.data[0] || null;
        }
        catch (err) {
            this.logger.error(`createSupportTicket failed: ${err.message}`);
            return null;
        }
    }
    async voteFeatureRequest(featureRequestId, userId, userToken) {
        try {
            const votePayload = {
                feature_request_id: featureRequestId,
                user_id: userId,
                created_at: new Date().toISOString()
            };
            await axios_1.default.post(`${this.supabaseUrl}/rest/v1/feature_request_votes`, votePayload, { headers: this.getHeaders(userToken) });
            const getResponse = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/feature_requests?id=eq.${featureRequestId}`, { headers: this.getHeaders(userToken) });
            const featureRequest = getResponse.data[0];
            if (!featureRequest)
                throw new Error('Feature request not found');
            const updatedVotes = Number(featureRequest.votes || 0) + 1;
            const patchResponse = await axios_1.default.patch(`${this.supabaseUrl}/rest/v1/feature_requests?id=eq.${featureRequestId}`, { votes: updatedVotes }, {
                headers: {
                    ...this.getHeaders(userToken),
                    'Prefer': 'return=representation'
                }
            });
            return patchResponse.data[0] || null;
        }
        catch (err) {
            if (err.response?.status === 409 || err.message?.includes('duplicate key')) {
                throw new Error('User has already voted for this feature request');
            }
            this.logger.error(`voteFeatureRequest failed: ${err.message}`);
            throw err;
        }
    }
    async getMySupportTickets(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/support_tickets?user_id=eq.${userId}&order=created_at.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.error(`getMySupportTickets failed: ${err.message}`);
            return [];
        }
    }
    async getCommunityFeatureRequests(userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/feature_requests?order=votes.desc,created_at.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.error(`getCommunityFeatureRequests failed: ${err.message}`);
            return [];
        }
    }
    async getAllSupportTickets(userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/support_tickets?order=created_at.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.error(`getAllSupportTickets failed: ${err.message}`);
            return [];
        }
    }
    async updateTicketStatus(ticketId, status, userToken) {
        try {
            const getResponse = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/support_tickets?id=eq.${ticketId}`, { headers: this.getHeaders(userToken) });
            const ticket = getResponse.data[0];
            if (!ticket)
                throw new Error('Support ticket not found');
            const response = await axios_1.default.patch(`${this.supabaseUrl}/rest/v1/support_tickets?id=eq.${ticketId}`, { status }, {
                headers: {
                    ...this.getHeaders(userToken),
                    'Prefer': 'return=representation'
                }
            });
            const refId = ticket.reference_id;
            const type = ticket.ticket_type;
            if (refId) {
                if (type === 'Bug Report') {
                    await axios_1.default.patch(`${this.supabaseUrl}/rest/v1/bug_reports?id=eq.${refId}`, { status }, { headers: this.getHeaders(userToken) });
                }
                else if (type === 'Feature Request') {
                    await axios_1.default.patch(`${this.supabaseUrl}/rest/v1/feature_requests?id=eq.${refId}`, { status }, { headers: this.getHeaders(userToken) });
                }
            }
            return response.data[0] || null;
        }
        catch (err) {
            this.logger.error(`updateTicketStatus failed: ${err.message}`);
            throw err;
        }
    }
    async getUserNotes(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/user_notes?user_id=eq.${userId}&order=created_at.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getUserNotes failed: ${err.message}`);
            return [];
        }
    }
    async getResearchNotes(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/research_notes?user_id=eq.${userId}&order=created_at.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getResearchNotes failed: ${err.message}`);
            return [];
        }
    }
    async getAnalyticsRecord(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/analytics?user_id=eq.${userId}&order=created_at.desc&limit=1`, { headers: this.getHeaders(userToken) });
            return response.data[0] || null;
        }
        catch (err) {
            this.logger.warn(`Supabase getAnalyticsRecord failed: ${err.message}`);
            return null;
        }
    }
    async getProgressReportRecord(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/progress_reports?user_id=eq.${userId}&order=created_at.desc&limit=1`, { headers: this.getHeaders(userToken) });
            return response.data[0] || null;
        }
        catch (err) {
            this.logger.warn(`Supabase getProgressReportRecord failed: ${err.message}`);
            return null;
        }
    }
    async getInternshipApplications(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/internship_applications?user_id=eq.${userId}&order=created_at.desc`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getInternshipApplications failed: ${err.message}`);
            return [];
        }
    }
    async getUserBugReports(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/bug_reports?user_id=eq.${userId}`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getUserBugReports failed: ${err.message}`);
            return [];
        }
    }
    async getUserFeatureRequests(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/feature_requests?user_id=eq.${userId}`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getUserFeatureRequests failed: ${err.message}`);
            return [];
        }
    }
    async getUserRatings(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/feedback_ratings?user_id=eq.${userId}`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getUserRatings failed: ${err.message}`);
            return [];
        }
    }
    async getUserAiFeedbacks(userId, userToken) {
        try {
            const response = await axios_1.default.get(`${this.supabaseUrl}/rest/v1/ai_feedback?user_id=eq.${userId}`, { headers: this.getHeaders(userToken) });
            return response.data || [];
        }
        catch (err) {
            this.logger.warn(`Supabase getUserAiFeedbacks failed: ${err.message}`);
            return [];
        }
    }
    async ensureBucketExists(bucket, userToken) {
        try {
            const headers = this.getHeaders(userToken);
            await axios_1.default.post(`${this.supabaseUrl}/storage/v1/bucket`, { id: bucket, name: bucket, public: false }, { headers });
            this.logger.log(`Supabase bucket '${bucket}' created or already exists.`);
        }
        catch (err) {
            if (err.response?.status !== 409) {
                this.logger.warn(`ensureBucketExists failed: ${err.message}`);
            }
        }
    }
    async uploadFileToStorage(bucket, storagePath, fileBuffer, mimeType, userToken) {
        try {
            await this.ensureBucketExists(bucket, userToken);
            const headers = {
                ...this.getHeaders(userToken),
                'Content-Type': mimeType,
            };
            const url = `${this.supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`;
            await axios_1.default.post(url, fileBuffer, { headers });
            const privateRef = `supabase://${bucket}/${storagePath}`;
            this.logger.log(`Uploaded file to private Supabase Storage: ${privateRef}`);
            return privateRef;
        }
        catch (err) {
            this.logger.error(`Supabase uploadFileToStorage failed: ${err.message}`, err.response?.data);
            throw err;
        }
    }
    async getSignedUrl(bucket, path, expiresIn = 3600) {
        if (!this.isConfigured())
            return null;
        try {
            const response = await axios_1.default.post(`${this.supabaseUrl}/storage/v1/object/sign/${bucket}/${path}`, { expiresIn }, { headers: this.getHeaders() });
            const signedPath = response.data?.signedURL;
            if (!signedPath)
                return null;
            return `${this.supabaseUrl}${signedPath}`;
        }
        catch (err) {
            this.logger.warn(`getSignedUrl failed: ${err.message}`);
            return null;
        }
    }
    async upsertNotebookDocument(payload, userToken) {
        try {
            const response = await axios_1.default.post(`${this.supabaseUrl}/rest/v1/notebook_documents`, payload, {
                headers: {
                    ...this.getHeaders(userToken),
                    'Prefer': 'resolution=merge-duplicates,return=representation',
                },
            });
            return response.data[0] || null;
        }
        catch (err) {
            this.logger.error(`Supabase upsertNotebookDocument failed: ${err.message}`);
            throw err;
        }
    }
};
exports.SupabaseService = SupabaseService;
exports.SupabaseService = SupabaseService = SupabaseService_1 = __decorate([
    (0, common_1.Injectable)()
], SupabaseService);
//# sourceMappingURL=supabase.service.js.map