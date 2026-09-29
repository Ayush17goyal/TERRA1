import { ExamService } from './exam.service';
import { GoogleCalendarService } from './google-calendar.service';
import { NotificationService } from './notification.service';
import { Repository } from 'typeorm';
import { Exam, MockTest, CalendarEvent } from './exam.entities';
import { SettingsService } from '../settings/settings.service';
import { SupabaseService } from '../settings/supabase.service';
export declare class ExamController {
    private readonly examService;
    private readonly googleCalendarService;
    private readonly notificationService;
    private readonly supabaseService;
    private readonly examRepository;
    private readonly mockTestRepository;
    private readonly calendarEventRepository;
    private readonly settings;
    private readonly logger;
    constructor(examService: ExamService, googleCalendarService: GoogleCalendarService, notificationService: NotificationService, supabaseService: SupabaseService, examRepository: Repository<Exam>, mockTestRepository: Repository<MockTest>, calendarEventRepository: Repository<CalendarEvent>, settings: SettingsService);
    createExam(req: any, body: {
        subject: string;
        examDate: string;
        prepLevel: 'Beginner' | 'Intermediate' | 'Expert';
        syllabusCompletion: number;
        emailReminderEnabled?: boolean;
        emailReminderMinutes?: number;
        examTime?: string;
    }): Promise<{
        exam: Exam;
        roadmap: import("./exam.entities").Roadmap;
        revisionPlan: import("./exam.entities").RevisionPlan;
        mockTests: MockTest[];
        calendarEvents: CalendarEvent[];
        readiness: import("./exam.entities").ReadinessSnapshot;
        recommendations: import("./exam.entities").Recommendation[];
        notifications: import("./exam.entities").Notification[];
    }>;
    getAnalytics(req: any): Promise<{
        productivityScore: number;
        consistencyScore: number;
        streak: number;
        examReadiness: number;
        revisionConfidence: number;
        researchProgress: number;
        mootReadiness: number;
        masteryScore: number;
    }>;
    getLexMentorStrategy(req: any, mode: string): Promise<{
        strategy: string;
    }>;
    getRecommendations(req: any): Promise<import("./exam.entities").Recommendation[]>;
    getNotifications(req: any): Promise<import("./exam.entities").Notification[]>;
    getOAuthUrl(): Promise<{
        url: string;
    }>;
    getOAuthStatus(req: any): Promise<{
        connected: boolean;
    }>;
    getEvents(req: any): Promise<CalendarEvent[]>;
    listExams(req: any): Promise<Exam[]>;
    sendExamReminderTestEmail(req: any): Promise<{
        success: boolean;
        recipient: any;
        sender: string;
    }>;
    getExamDetails(req: any, id: string): Promise<{
        exam: Exam;
        readiness: import("./exam.entities").ReadinessSnapshot;
        mockTests: MockTest[];
    }>;
    submitMockScore(req: any, examId: string, body: {
        title: string;
        score: number;
    }): Promise<{
        success: boolean;
        snapshot: import("./exam.entities").ReadinessSnapshot;
        mockTest: MockTest;
    }>;
    generateMockPaper(req: any, body: {
        subject: string;
        paperType: string;
        topics: Array<{
            title: string;
            difficulty?: string;
            pyqFrequency?: number;
        }>;
    }): Promise<any>;
    evaluateMockPaper(req: any, body: {
        subject: string;
        paperType: string;
        questions: any[];
        answers: Record<string, string>;
    }): Promise<any>;
    getStudyLibraryStats(req: any): Promise<{
        documentsIndexed: number;
        topicsIdentified: number;
        unitsDetected: number;
        previousYearPapersCount: number;
        teacherNotesCount: number;
        coverageScore: number;
        lastUpdated: any;
    }>;
    generateGroundedMockTest(req: any, body: {
        prompt: string;
        docId?: string;
        settings?: any;
    }): Promise<{
        success: boolean;
        message: any;
        questions: any[];
        id?: undefined;
        title?: undefined;
        subject?: undefined;
        difficulty?: undefined;
        totalMarks?: undefined;
        timeMinutes?: undefined;
        sourceCoverage?: undefined;
        instructions?: undefined;
    } | {
        id: string;
        success: boolean;
        title: any;
        subject: any;
        difficulty: string;
        totalMarks: any;
        timeMinutes: any;
        sourceCoverage: any;
        instructions: any;
        questions: any[];
        message?: undefined;
    }>;
    generateGroundedMockAnswer(req: any, body: {
        prompt?: string;
        question: any;
        docId?: string;
        answerDepth?: string;
        insufficientMaterialMessage?: string;
    }): Promise<{
        modelAnswer: string;
        wordCount: number;
        answerWordCount: number;
        answerDepth: "long" | "detailed" | "medium" | "short";
        answerLengthTarget: string;
        insufficientMaterialWarning: string;
        sourceChunks: {
            sourceChunk: any;
            chunkId: any;
            documentName: any;
            pageNumber: any;
            section: any;
            excerpt: string;
        }[];
        importantJudgments: string[];
        relevantArticles: string[];
        relevantSections: string[];
        grounding: any;
    }>;
    generatePredictedAnalysis(req: any): Promise<any>;
    runAssistant(req: any, body: {
        query: string;
    }): Promise<Exam>;
    solveDoubt(req: any, body: {
        question: string;
    }): Promise<{
        answer: string;
        citations: any[];
    }>;
    saveTokens(req: any, body: {
        accessToken: string;
        refreshToken?: string;
        expiresSec: number;
    }): Promise<{
        success: boolean;
    }>;
    handleOAuthCallback(req: any, body: {
        code: string;
    }): Promise<{
        success: boolean;
    }>;
    disconnectOAuth(req: any): Promise<{
        success: boolean;
    }>;
    readNotifications(req: any): Promise<{
        success: boolean;
    }>;
    createLocalEvent(req: any, body: {
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
    }): Promise<CalendarEvent | {
        googleEventId: string;
        isSynced: boolean;
    }>;
    updateLocalEvent(req: any, id: string, body: {
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
    }): Promise<any>;
    deleteLocalEvent(req: any, id: string): Promise<{
        success: boolean;
    }>;
}
