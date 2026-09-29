import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Req, Logger, Query, BadRequestException } from '@nestjs/common';
import { ExamService } from './exam.service';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';
import { GoogleCalendarService } from './google-calendar.service';
import { NotificationService } from './notification.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam, MockTest, CalendarEvent } from './exam.entities';
import { SettingsService } from '../settings/settings.service';
import { SupabaseService } from '../settings/supabase.service';
import axios from 'axios';

@Controller('exam')
@UseGuards(ClerkAuthGuard)
export class ExamController {
  private readonly logger = new Logger(ExamController.name);
  constructor(
    private readonly examService: ExamService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly notificationService: NotificationService,
    private readonly supabaseService: SupabaseService,
    @InjectRepository(Exam)
    private readonly examRepository: Repository<Exam>,
    @InjectRepository(MockTest)
    private readonly mockTestRepository: Repository<MockTest>,
    @InjectRepository(CalendarEvent)
    private readonly calendarEventRepository: Repository<CalendarEvent>,
    private readonly settings: SettingsService,
  ) {}

  @Post()
  async createExam(
    @Req() req: any,
    @Body() body: {
      subject: string;
      examDate: string;
      prepLevel: 'Beginner' | 'Intermediate' | 'Expert';
      syllabusCompletion: number;
      emailReminderEnabled?: boolean;
      emailReminderMinutes?: number;
      examTime?: string;
    }
  ) {
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

  @Get('analytics')
  async getAnalytics(@Req() req: any) {
    return this.examService.calculateAnalytics(req.user.id);
  }

  @Get('lexmentor/strategy')
  async getLexMentorStrategy(@Req() req: any, @Query('mode') mode: string) {
    const strategy = await this.examService.generateStrategyForMode(req.user.id, mode || 'plan');
    return { strategy };
  }

  @Get('dashboard/recommendations')
  async getRecommendations(@Req() req: any) {
    return this.examService.getRecommendations(req.user.id);
  }

  @Get('dashboard/notifications')
  async getNotifications(@Req() req: any) {
    await this.notificationService.runNotificationChecks(req.user.id);
    return this.notificationService.getTriggeredNotifications(req.user.id);
  }

  @Get('oauth/url')
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
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=${encodeURIComponent(
      scopes.join(' '),
    )}&access_type=offline&prompt=consent`;
    return { url };
  }

  @Get('oauth/status')
  async getOAuthStatus(@Req() req: any) {
    const token = await this.googleCalendarService.getValidToken(req.user.id);
    return { connected: !!token };
  }

  @Get('calendar/events')
  async getEvents(@Req() req: any) {
    return this.calendarEventRepository.find({
      where: { userId: req.user.id },
      order: { eventDate: 'ASC', eventTime: 'ASC' },
    });
  }

  @Get()
  async listExams(@Req() req: any) {
    return this.examRepository.find({
      where: { userId: req.user.id },
      order: { examDate: 'ASC' },
    });
  }

  @Post('notifications/test-email')
  async sendExamReminderTestEmail(@Req() req: any) {
    if (!req.user.email) {
      throw new BadRequestException('The logged-in Clerk account does not have an email address.');
    }

    await this.notificationService.sendNotificationEmail(
      req.user.email,
      'LEGATRIXON Exam Reminder Test',
      'Your LEGATRIXON exam reminder email is working. Future exam reminders will be sent to this logged-in account at the lead time selected in Exam Command Center.',
    );

    return {
      success: true,
      recipient: req.user.email,
      sender: 'legatrixon2026@gmail.com',
    };
  }

  @Get(':id')
  async getExamDetails(@Req() req: any, @Param('id') id: string) {
    const exam = await this.examRepository.findOne({ where: { id, userId: req.user.id } });
    if (!exam) throw new Error('Exam not found');

    const readiness = await this.examService.getReadinessSnapshot(exam.id);
    const mockTests = await this.mockTestRepository.find({ where: { examId: exam.id } });

    return {
      exam,
      readiness,
      mockTests,
    };
  }

  @Post(':id/mock')
  async submitMockScore(
    @Req() req: any,
    @Param('id') examId: string,
    @Body() body: { title: string; score: number }
  ) {
    const exam = await this.examRepository.findOne({ where: { id: examId, userId: req.user.id } });
    if (!exam) throw new Error('Exam not found');

    const test = new MockTest();
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

  @Post('mock-paper/generate')
  async generateMockPaper(
    @Req() req: any,
    @Body() body: { subject: string; paperType: string; topics: Array<{ title: string; difficulty?: string; pyqFrequency?: number }> },
  ) {
    let paper;
    try {
      paper = await this.examService.generateMockPaper(body);
    } catch (error) {
      throw new BadRequestException(error.message || 'Mock-paper generation failed.');
    }
    await this.settings.log({
      userId: req.user.id,
      module: 'Exam Command Center',
      action: 'Generated Mock Paper',
      metadata: { subject: body.subject, paperType: body.paperType, questions: paper.questions.length },
    });
    return paper;
  }

  @Post('mock-paper/evaluate')
  async evaluateMockPaper(
    @Req() req: any,
    @Body() body: { subject: string; paperType: string; questions: any[]; answers: Record<string, string> },
  ) {
    let evaluation;
    try {
      evaluation = await this.examService.evaluateMockPaper(body);
    } catch (error) {
      throw new BadRequestException(error.message || 'Mock-paper evaluation failed.');
    }
    await this.settings.log({
      userId: req.user.id,
      module: 'Exam Command Center',
      action: 'Submitted Mock Paper',
      metadata: { subject: body.subject, paperType: body.paperType, percentage: evaluation.percentage },
    });
    return evaluation;
  }

  @Get('study-library/stats')
  async getStudyLibraryStats(@Req() req: any) {
    return this.examService.getStudyLibraryStats(req.user.id);
  }

  @Post('study-library/generate-test')
  async generateGroundedMockTest(
    @Req() req: any,
    @Body() body: { prompt: string; docId?: string; settings?: any }
  ) {
    return this.examService.generateGroundedMockTest(req.user.id, body.prompt, body.docId, body.settings);
  }

  @Post('study-library/generate-answer')
  async generateGroundedMockAnswer(
    @Req() req: any,
    @Body() body: { prompt?: string; question: any; docId?: string; answerDepth?: string; insufficientMaterialMessage?: string }
  ) {
    return this.examService.regenerateGroundedMockAnswer(req.user.id, body);
  }

  @Post('study-library/insights')
  async generatePredictedAnalysis(@Req() req: any) {
    return this.examService.generatePredictedAnalysis(req.user.id);
  }

  @Post('assistant')
  async runAssistant(@Req() req: any, @Body() body: { query: string }) {
    const result = await this.examService.parseCalendarAssistantInput(req.user.id, body.query);
    await this.settings.log({
      userId: req.user.id,
      module: 'Academic Navigator',
      action: 'Used Calendar Assistant',
      metadata: { characters: body.query?.length || 0 },
    });
    return result;
  }

  @Post('doubt-solve')
  async solveDoubt(@Req() req: any, @Body() body: { question: string }) {
    const result = await this.examService.solveLegalDoubt(req.user.id, body.question);
    await this.settings.log({
      userId: req.user.id,
      module: 'Exam Command Center',
      action: 'Solved Doubt',
      metadata: { characters: body.question?.length || 0 },
    });
    return result;
  }

  @Post('oauth-tokens')
  async saveTokens(
    @Req() req: any,
    @Body() body: { accessToken: string; refreshToken?: string; expiresSec: number }
  ) {
    await this.googleCalendarService.saveTokens(
      req.user.id,
      body.accessToken,
      body.refreshToken || null,
      body.expiresSec
    );
    return { success: true };
  }

  @Post('oauth/callback')
  async handleOAuthCallback(@Req() req: any, @Body() body: { code: string }) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth configuration parameters are missing.');
    }

    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: clientId,
        client_secret: clientSecret,
        code: body.code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });

      const { access_token, refresh_token, expires_in } = response.data;
      await this.googleCalendarService.saveTokens(
        req.user.id,
        access_token,
        refresh_token || null,
        expires_in,
      );

      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
      this.logger.error(`[Google Calendar] OAuth Failure: ${errorMsg}`);
      throw new Error(`Failed to exchange code for tokens: ${errorMsg}`);
    }
  }

  @Post('oauth/disconnect')
  async disconnectOAuth(@Req() req: any) {
    await this.googleCalendarService.saveTokens(req.user.id, '', '', 0);
    return { success: true };
  }

  @Post('dashboard/notifications/read')
  async readNotifications(@Req() req: any) {
    await this.notificationService.markAsRead(req.user.id);
    return { success: true };
  }

  @Post('calendar/events')
  async createLocalEvent(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      date: string;
      time: string;
      endDate?: string;
      subject: string;
      type: any;
      description?: string;
      priority?: string;
      category?: string;
      moduleSource?: string;
      syncOnly?: boolean;
    },
  ) {
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

    const event = new CalendarEvent();
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

    // Sync to Google Calendar
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

  @Patch('calendar/events/:id')
  async updateLocalEvent(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      date?: string;
      time?: string;
      endDate?: string;
      subject?: string;
      type?: any;
      description?: string;
      priority?: string;
      category?: string;
      moduleSource?: string;
    },
  ) {
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
    if (!event) throw new Error('Event not found');

    if (body.title !== undefined) event.title = body.title;
    if (body.date !== undefined) event.eventDate = body.date;
    if (body.time !== undefined) event.eventTime = body.time;
    if (body.endDate !== undefined) event.endDate = body.endDate;
    if (body.subject !== undefined) event.subject = body.subject;
    if (body.type !== undefined) event.eventType = body.type;
    if (body.description !== undefined) event.description = body.description;
    if (body.priority !== undefined) event.priority = body.priority;
    if (body.category !== undefined) event.category = body.category;
    if (body.moduleSource !== undefined) event.moduleSource = body.moduleSource;

    const saved = await this.calendarEventRepository.save(event);

    // Sync corresponding Exam profile if eventType is exam
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

        // Sync to Supabase
        try {
          await axios.patch(
            `${this.supabaseService.supabaseUrl}/rest/v1/exams?id=eq.${event.examId}`,
            {
              exam_date: exam.examDate.toISOString(),
              exam_time: exam.examTime,
              reminder_trigger_at: exam.reminderTriggerAt ? exam.reminderTriggerAt.toISOString() : null,
            },
            { headers: this.supabaseService.getHeaders() }
          );
        } catch (err: any) {
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

  @Delete('calendar/events/:id')
  async deleteLocalEvent(@Req() req: any, @Param('id') id: string) {
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
    if (!event) throw new Error('Event not found');

    if (event.googleEventId) {
      await this.googleCalendarService.deleteGoogleEvent(req.user.id, event.googleEventId);
    }

    // Sync corresponding Exam deletion if eventType is exam
    if (event.eventType === 'exam' && event.examId) {
      const exam = await this.examRepository.findOne({ where: { id: event.examId } });
      if (exam) {
        await this.examRepository.remove(exam);
        
        // Sync to Supabase
        try {
          await axios.delete(
            `${this.supabaseService.supabaseUrl}/rest/v1/exams?id=eq.${event.examId}`,
            { headers: this.supabaseService.getHeaders() }
          );
        } catch (err: any) {
          this.logger.warn(`Failed to sync deleted exam to Supabase: ${err.message}`);
        }
      }
    }

    await this.calendarEventRepository.remove(event);
    return { success: true };
  }
}
