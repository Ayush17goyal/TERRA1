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
var ExamController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamController = void 0;
const common_1 = require("@nestjs/common");
const exam_service_1 = require("./exam.service");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const google_calendar_service_1 = require("./google-calendar.service");
const notification_service_1 = require("./notification.service");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const exam_entities_1 = require("./exam.entities");
const settings_service_1 = require("../settings/settings.service");
const supabase_service_1 = require("../settings/supabase.service");
const axios_1 = require("axios");
let ExamController = ExamController_1 = class ExamController {
    constructor(examService, googleCalendarService, notificationService, supabaseService, examRepository, mockTestRepository, calendarEventRepository, settings) {
        this.examService = examService;
        this.googleCalendarService = googleCalendarService;
        this.notificationService = notificationService;
        this.supabaseService = supabaseService;
        this.examRepository = examRepository;
        this.mockTestRepository = mockTestRepository;
        this.calendarEventRepository = calendarEventRepository;
        this.settings = settings;
        this.logger = new common_1.Logger(ExamController_1.name);
    }
    async createExam(req, body) {
        const examData = await this.examService.createExamAndFetchAll(req.user.id, {
            subject: body.subject,
            examDate: new Date(body.examDate),
            prepLevel: body.prepLevel,
            syllabusCompletion: body.syllabusCompletion,
            emailReminderEnabled: body.emailReminderEnabled,
            emailReminderMinutes: body.emailReminderMinutes,
            examTime: body.examTime,
            clerkUserId: req.user.id,
            fullName: req.user.fullName || 'Student',
            email: req.user.email || '',
        });
        await this.settings.log({
            userId: req.user.id,
            module: 'Exam Command Center',
            action: 'Created Study Plan',
            metadata: { subject: body.subject, prepLevel: body.prepLevel },
        });
        return examData;
    }
    async getAnalytics(req) {
        return this.examService.calculateAnalytics(req.user.id);
    }
    async getLexMentorStrategy(req, mode) {
        const strategy = await this.examService.generateStrategyForMode(req.user.id, mode || 'plan');
        return { strategy };
    }
    async getRecommendations(req) {
        return this.examService.getRecommendations(req.user.id);
    }
    async getNotifications(req) {
        await this.notificationService.runNotificationChecks(req.user.id);
        return this.notificationService.getTriggeredNotifications(req.user.id);
    }
    async getOAuthUrl() {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI;
        if (!clientId || !redirectUri) {
            throw new Error('Google Client ID or Redirect URI is missing from environment.');
        }
        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
        ];
        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&access_type=offline&prompt=consent`;
        return { url };
    }
    async getOAuthStatus(req) {
        const token = await this.googleCalendarService.getValidToken(req.user.id);
        return { connected: !!token };
    }
    async getEvents(req) {
        return this.calendarEventRepository.find({
            where: { userId: req.user.id },
            order: { eventDate: 'ASC', eventTime: 'ASC' },
        });
    }
    async listExams(req) {
        return this.examRepository.find({
            where: { userId: req.user.id },
            order: { examDate: 'ASC' },
        });
    }
    async sendExamReminderTestEmail(req) {
        if (!req.user.email) {
            throw new common_1.BadRequestException('The logged-in Clerk account does not have an email address.');
        }
        await this.notificationService.sendNotificationEmail(req.user.email, 'LEGATRIXON Exam Reminder Test', 'Your LEGATRIXON exam reminder email is working. Future exam reminders will be sent to this logged-in account at the lead time selected in Exam Command Center.');
        return {
            success: true,
            recipient: req.user.email,
            sender: 'legatrixon2026@gmail.com',
        };
    }
    async getExamDetails(req, id) {
        const exam = await this.examRepository.findOne({ where: { id, userId: req.user.id } });
        if (!exam)
            throw new Error('Exam not found');
        const readiness = await this.examService.getReadinessSnapshot(exam.id);
        const mockTests = await this.mockTestRepository.find({ where: { examId: exam.id } });
        return {
            exam,
            readiness,
            mockTests,
        };
    }
    async submitMockScore(req, examId, body) {
        const exam = await this.examRepository.findOne({ where: { id: examId, userId: req.user.id } });
        if (!exam)
            throw new Error('Exam not found');
        const test = new exam_entities_1.MockTest();
        test.examId = examId;
        test.subject = exam.subject;
        test.title = body.title;
        test.score = body.score;
        test.date = new Date();
        test.weakSubjects = [];
        await this.mockTestRepository.save(test);
        const snapshot = await this.examService.calculateAndSaveReadiness(examId);
        await this.settings.log({
            userId: req.user.id,
            module: 'Exam Command Center',
            action: 'Completed Quiz',
            metadata: { examId, score: body.score, title: body.title },
        });
        return { success: true, snapshot, mockTest: test };
    }
    async generateMockPaper(req, body) {
        let paper;
        try {
            paper = await this.examService.generateMockPaper(body);
        }
        catch (error) {
            throw new common_1.BadRequestException(error.message || 'Mock-paper generation failed.');
        }
        await this.settings.log({
            userId: req.user.id,
            module: 'Exam Command Center',
            action: 'Generated Mock Paper',
            metadata: { subject: body.subject, paperType: body.paperType, questions: paper.questions.length },
        });
        return paper;
    }
    async evaluateMockPaper(req, body) {
        let evaluation;
        try {
            evaluation = await this.examService.evaluateMockPaper(body);
        }
        catch (error) {
            throw new common_1.BadRequestException(error.message || 'Mock-paper evaluation failed.');
        }
        await this.settings.log({
            userId: req.user.id,
            module: 'Exam Command Center',
            action: 'Submitted Mock Paper',
            metadata: { subject: body.subject, paperType: body.paperType, percentage: evaluation.percentage },
        });
        return evaluation;
    }
    async getStudyLibraryStats(req) {
        return this.examService.getStudyLibraryStats(req.user.id);
    }
    async generateGroundedMockTest(req, body) {
        return this.examService.generateGroundedMockTest(req.user.id, body.prompt, body.docId, body.settings);
    }
    async generateGroundedMockAnswer(req, body) {
        return this.examService.regenerateGroundedMockAnswer(req.user.id, body);
    }
    async generatePredictedAnalysis(req) {
        return this.examService.generatePredictedAnalysis(req.user.id);
    }
    async runAssistant(req, body) {
        const result = await this.examService.parseCalendarAssistantInput(req.user.id, body.query);
        await this.settings.log({
            userId: req.user.id,
            module: 'Academic Navigator',
            action: 'Used Calendar Assistant',
            metadata: { characters: body.query?.length || 0 },
        });
        return result;
    }
    async solveDoubt(req, body) {
        const result = await this.examService.solveLegalDoubt(req.user.id, body.question);
        await this.settings.log({
            userId: req.user.id,
            module: 'Exam Command Center',
            action: 'Solved Doubt',
            metadata: { characters: body.question?.length || 0 },
        });
        return result;
    }
    async saveTokens(req, body) {
        await this.googleCalendarService.saveTokens(req.user.id, body.accessToken, body.refreshToken || null, body.expiresSec);
        return { success: true };
    }
    async handleOAuthCallback(req, body) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI;
        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error('Google OAuth configuration parameters are missing.');
        }
        try {
            const response = await axios_1.default.post('https://oauth2.googleapis.com/token', {
                client_id: clientId,
                client_secret: clientSecret,
                code: body.code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            });
            const { access_token, refresh_token, expires_in } = response.data;
            await this.googleCalendarService.saveTokens(req.user.id, access_token, refresh_token || null, expires_in);
            return { success: true };
        }
        catch (error) {
            const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
            this.logger.error(`[Google Calendar] OAuth Failure: ${errorMsg}`);
            throw new Error(`Failed to exchange code for tokens: ${errorMsg}`);
        }
    }
    async disconnectOAuth(req) {
        await this.googleCalendarService.saveTokens(req.user.id, '', '', 0);
        return { success: true };
    }
    async readNotifications(req) {
        await this.notificationService.markAsRead(req.user.id);
        return { success: true };
    }
    async createLocalEvent(req, body) {
        if (!body.title || !body.title.trim()) {
            throw new Error('Title is required');
        }
        if (!body.date) {
            throw new Error('Date is required');
        }
        if (!body.time) {
            throw new Error('Time is required');
        }
        if (!body.subject) {
            throw new Error('Subject is required');
        }
        if (!body.type) {
            throw new Error('Event type is required');
        }
        if (body.syncOnly) {
            const googleEventId = await this.googleCalendarService.createGoogleEvent(req.user.id, {
                title: body.title.trim(),
                date: body.date,
                time: body.time,
                subject: body.subject,
                description: body.description || '',
                priority: body.priority || 'Medium',
                category: body.category || body.type,
                moduleSource: body.moduleSource || body.subject,
                eventType: body.type,
            });
            return { googleEventId, isSynced: !!googleEventId };
        }
        const event = new exam_entities_1.CalendarEvent();
        event.userId = req.user.id;
        event.title = body.title;
        event.eventDate = body.date;
        event.endDate = body.endDate || body.date;
        event.eventTime = body.time;
        event.subject = body.subject;
        event.eventType = body.type;
        event.description = body.description || '';
        event.priority = body.priority || 'Medium';
        event.category = body.category || body.type;
        event.moduleSource = body.moduleSource || body.subject;
        const saved = await this.calendarEventRepository.save(event);
        const gEventId = await this.googleCalendarService.createGoogleEvent(req.user.id, {
            title: event.title,
            date: event.eventDate,
            time: event.eventTime,
            subject: event.subject,
            description: event.description,
            priority: event.priority,
            category: event.category,
            moduleSource: event.moduleSource,
            eventType: event.eventType,
        });
        if (gEventId) {
            saved.googleEventId = gEventId;
            saved.isSynced = true;
            await this.calendarEventRepository.save(saved);
        }
        await this.settings.log({
            userId: req.user.id,
            module: 'Academic Navigator',
            action: 'Created Calendar Event',
            metadata: { eventType: event.eventType, subject: event.subject },
        });
        return saved;
    }
    async updateLocalEvent(req, id, body) {
        let event = null;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        if (isUuid) {
            event = await this.calendarEventRepository.findOne({
                where: { id, userId: req.user.id },
            });
        }
        if (!event) {
            event = await this.calendarEventRepository.findOne({
                where: { googleEventId: id, userId: req.user.id },
            });
        }
        if (!event)
            throw new Error('Event not found');
        if (body.title !== undefined)
            event.title = body.title;
        if (body.date !== undefined)
            event.eventDate = body.date;
        if (body.time !== undefined)
            event.eventTime = body.time;
        if (body.endDate !== undefined)
            event.endDate = body.endDate;
        if (body.subject !== undefined)
            event.subject = body.subject;
        if (body.type !== undefined)
            event.eventType = body.type;
        if (body.description !== undefined)
            event.description = body.description;
        if (body.priority !== undefined)
            event.priority = body.priority;
        if (body.category !== undefined)
            event.category = body.category;
        if (body.moduleSource !== undefined)
            event.moduleSource = body.moduleSource;
        const saved = await this.calendarEventRepository.save(event);
        if (event.eventType === 'exam' && event.examId) {
            const exam = await this.examRepository.findOne({ where: { id: event.examId } });
            if (exam) {
                const dateStr = body.date !== undefined ? body.date : event.eventDate;
                const timeStr = body.time !== undefined ? body.time : event.eventTime;
                exam.examDate = new Date(`${dateStr}T${timeStr || '00:00:00'}`);
                if (body.time !== undefined) {
                    exam.examTime = body.time;
                }
                if (exam.emailReminderEnabled && exam.emailReminderMinutes) {
                    exam.reminderTriggerAt = new Date(exam.examDate.getTime() - exam.emailReminderMinutes * 60 * 1000);
                }
                await this.examRepository.save(exam);
                try {
                    await axios_1.default.patch(`${this.supabaseService.supabaseUrl}/rest/v1/exams?id=eq.${event.examId}`, {
                        exam_date: exam.examDate.toISOString(),
                        exam_time: exam.examTime,
                        reminder_trigger_at: exam.reminderTriggerAt ? exam.reminderTriggerAt.toISOString() : null,
                    }, { headers: this.supabaseService.getHeaders() });
                }
                catch (err) {
                    this.logger.warn(`Failed to sync updated exam date/time to Supabase: ${err.message}`);
                }
            }
        }
        if (event.googleEventId) {
            await this.googleCalendarService.updateGoogleEvent(req.user.id, event.googleEventId, {
                title: event.title,
                date: event.eventDate,
                time: event.eventTime,
                subject: event.subject,
                description: event.description,
                priority: event.priority,
                category: event.category || event.eventType,
                moduleSource: event.moduleSource,
            });
        }
        return saved;
    }
    async deleteLocalEvent(req, id) {
        let event = null;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        if (isUuid) {
            event = await this.calendarEventRepository.findOne({
                where: { id, userId: req.user.id },
            });
        }
        if (!event) {
            event = await this.calendarEventRepository.findOne({
                where: { googleEventId: id, userId: req.user.id },
            });
        }
        if (!event)
            throw new Error('Event not found');
        if (event.googleEventId) {
            await this.googleCalendarService.deleteGoogleEvent(req.user.id, event.googleEventId);
        }
        if (event.eventType === 'exam' && event.examId) {
            const exam = await this.examRepository.findOne({ where: { id: event.examId } });
            if (exam) {
                await this.examRepository.remove(exam);
                try {
                    await axios_1.default.delete(`${this.supabaseService.supabaseUrl}/rest/v1/exams?id=eq.${event.examId}`, { headers: this.supabaseService.getHeaders() });
                }
                catch (err) {
                    this.logger.warn(`Failed to sync deleted exam to Supabase: ${err.message}`);
                }
            }
        }
        await this.calendarEventRepository.remove(event);
        return { success: true };
    }
};
exports.ExamController = ExamController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "createExam", null);
__decorate([
    (0, common_1.Get)('analytics'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "getAnalytics", null);
__decorate([
    (0, common_1.Get)('lexmentor/strategy'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('mode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "getLexMentorStrategy", null);
__decorate([
    (0, common_1.Get)('dashboard/recommendations'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "getRecommendations", null);
__decorate([
    (0, common_1.Get)('dashboard/notifications'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Get)('oauth/url'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "getOAuthUrl", null);
__decorate([
    (0, common_1.Get)('oauth/status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "getOAuthStatus", null);
__decorate([
    (0, common_1.Get)('calendar/events'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "getEvents", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "listExams", null);
__decorate([
    (0, common_1.Post)('notifications/test-email'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "sendExamReminderTestEmail", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "getExamDetails", null);
__decorate([
    (0, common_1.Post)(':id/mock'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "submitMockScore", null);
__decorate([
    (0, common_1.Post)('mock-paper/generate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "generateMockPaper", null);
__decorate([
    (0, common_1.Post)('mock-paper/evaluate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "evaluateMockPaper", null);
__decorate([
    (0, common_1.Get)('study-library/stats'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "getStudyLibraryStats", null);
__decorate([
    (0, common_1.Post)('study-library/generate-test'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "generateGroundedMockTest", null);
__decorate([
    (0, common_1.Post)('study-library/generate-answer'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "generateGroundedMockAnswer", null);
__decorate([
    (0, common_1.Post)('study-library/insights'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "generatePredictedAnalysis", null);
__decorate([
    (0, common_1.Post)('assistant'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "runAssistant", null);
__decorate([
    (0, common_1.Post)('doubt-solve'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "solveDoubt", null);
__decorate([
    (0, common_1.Post)('oauth-tokens'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "saveTokens", null);
__decorate([
    (0, common_1.Post)('oauth/callback'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "handleOAuthCallback", null);
__decorate([
    (0, common_1.Post)('oauth/disconnect'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "disconnectOAuth", null);
__decorate([
    (0, common_1.Post)('dashboard/notifications/read'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "readNotifications", null);
__decorate([
    (0, common_1.Post)('calendar/events'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "createLocalEvent", null);
__decorate([
    (0, common_1.Patch)('calendar/events/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "updateLocalEvent", null);
__decorate([
    (0, common_1.Delete)('calendar/events/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "deleteLocalEvent", null);
exports.ExamController = ExamController = ExamController_1 = __decorate([
    (0, common_1.Controller)('exam'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __param(4, (0, typeorm_1.InjectRepository)(exam_entities_1.Exam)),
    __param(5, (0, typeorm_1.InjectRepository)(exam_entities_1.MockTest)),
    __param(6, (0, typeorm_1.InjectRepository)(exam_entities_1.CalendarEvent)),
    __metadata("design:paramtypes", [exam_service_1.ExamService,
        google_calendar_service_1.GoogleCalendarService,
        notification_service_1.NotificationService,
        supabase_service_1.SupabaseService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        settings_service_1.SettingsService])
], ExamController);
//# sourceMappingURL=exam.controller.js.map