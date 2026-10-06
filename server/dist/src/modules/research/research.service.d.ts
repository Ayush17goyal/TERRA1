import { Repository } from 'typeorm';
import { ResearchAsset, ResearchNote, ResearchQuery, ResearchReport, ResearchSource, ResearchUser, SavedReport, ResearchDocument, JudgmentReport } from './research.entities';
import { BgeM3Provider } from '../retrieval/bge-m3.provider';
import { QdrantService } from '../retrieval/qdrant.service';
import { LegalRetrievalService } from '../retrieval/legal-retrieval.service';
import { NotificationService } from '../exam/notification.service';
import { TokenOptimizationService } from '../chat/token-optimization.service';
import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
import { SemanticCacheService } from '../chat/semantic-cache.service';
export declare class ResearchService {
    private readonly users;
    private readonly queries;
    private readonly reports;
    private readonly sources;
    private readonly notes;
    private readonly savedReports;
    private readonly assets;
    private readonly documents;
    private readonly judgmentReports;
    private readonly bgeM3Provider;
    private readonly qdrantService;
    private readonly legalRetrievalService;
    private readonly notificationService;
    private readonly tokenService;
    private readonly aiProvider;
    private readonly cacheService;
    private readonly logger;
    constructor(users: Repository<ResearchUser>, queries: Repository<ResearchQuery>, reports: Repository<ResearchReport>, sources: Repository<ResearchSource>, notes: Repository<ResearchNote>, savedReports: Repository<SavedReport>, assets: Repository<ResearchAsset>, documents: Repository<ResearchDocument>, judgmentReports: Repository<JudgmentReport>, bgeM3Provider: BgeM3Provider, qdrantService: QdrantService, legalRetrievalService: LegalRetrievalService, notificationService: NotificationService, tokenService: TokenOptimizationService, aiProvider: OpenRouterAiProviderService, cacheService: SemanticCacheService);
    resolveUser(reqUser?: {
        id?: string;
        email?: string;
        fullName?: string;
    }): Promise<ResearchUser>;
    private deterministicUuid;
    createQuery(userId: string, body: {
        topic: string;
        researchMode: string;
    }): Promise<{
        query: ResearchQuery;
        report: {
            sources: ResearchSource[];
            notes: ResearchNote[];
            assets: ResearchAsset[];
            id: string;
            queryId: string;
            userId: string;
            title: string;
            summary: string;
            researchOutline: Record<string, unknown>;
            researchMode: string;
            createdAt: Date;
            updatedAt: Date;
            query: ResearchQuery;
        };
    }>;
    listQueries(userId: string): Promise<ResearchQuery[]>;
    getQuery(userId: string, id: string): Promise<ResearchQuery>;
    createReport(userId: string, body: Partial<ResearchReport> & {
        queryId: string;
    }): Promise<ResearchReport>;
    getReport(userId: string, id: string): Promise<{
        sources: ResearchSource[];
        notes: ResearchNote[];
        assets: ResearchAsset[];
        id: string;
        queryId: string;
        userId: string;
        title: string;
        summary: string;
        researchOutline: Record<string, unknown>;
        researchMode: string;
        createdAt: Date;
        updatedAt: Date;
        query: ResearchQuery;
    }>;
    updateReport(userId: string, id: string, body: Partial<ResearchReport>): Promise<{
        sources: ResearchSource[];
        notes: ResearchNote[];
        assets: ResearchAsset[];
        id: string;
        queryId: string;
        userId: string;
        title: string;
        summary: string;
        researchOutline: Record<string, unknown>;
        researchMode: string;
        createdAt: Date;
        updatedAt: Date;
        query: ResearchQuery;
    }>;
    deleteReport(userId: string, id: string): Promise<{
        success: boolean;
    }>;
    createSource(userId: string, body: Partial<ResearchSource> & {
        reportId: string;
        title: string;
        sourceType: ResearchSource['sourceType'];
    }): Promise<ResearchSource>;
    getSource(userId: string, id: string): Promise<ResearchSource>;
    deleteSource(userId: string, id: string): Promise<{
        success: boolean;
    }>;
    createNote(userId: string, body: {
        reportId: string;
        title: string;
        content: string;
    }): Promise<ResearchNote>;
    getNote(userId: string, id: string): Promise<ResearchNote>;
    updateNote(userId: string, id: string, body: Partial<ResearchNote>): Promise<ResearchNote>;
    deleteNote(userId: string, id: string): Promise<{
        success: boolean;
    }>;
    saveReport(userId: string, reportId: string): Promise<SavedReport>;
    listSavedReports(userId: string): Promise<SavedReport[]>;
    deleteSavedReport(userId: string, id: string): Promise<{
        success: boolean;
    }>;
    createAsset(userId: string, body: {
        reportId: string;
        assetType: ResearchAsset['assetType'];
        assetData: Record<string, unknown>;
    }): Promise<ResearchAsset>;
    uploadDocument(userId: string, file: any, queryId?: string, docCategory?: string): Promise<ResearchDocument>;
    private indexResearchDocument;
    private withTimeout;
    getDocuments(userId: string, queryId: string): Promise<ResearchDocument[]>;
    generateJudgmentIntelligence(userId: string, body: {
        queryId?: string;
        topic: string;
        researchMode: string;
        sources: string[];
        provider?: string;
        depth?: 'standard' | 'deep' | 'exhaustive';
    }): Promise<{
        id: string;
        userId: string;
        researchTopic: string;
        caseName: string;
        citation: string;
        court: string;
        judge: string;
        facts: any;
        issues: any;
        holdings: any;
        ratioDecidendi: string;
        obiterDicta: string;
        reliefGranted: string;
        impactAnalysis: string;
        researchMatrix: any;
        generatedReport: string;
        fileName: string;
        metadata: any;
        title: string;
        summary: string;
        researchMode: string;
        sources: any[];
        notes: any[];
        assets: any[];
        createdAt: Date;
        updatedAt: Date;
    }>;
    generateLegalBrief(userId: string, body: {
        queryId?: string;
        topic: string;
        researchMode: string;
        sources: string[];
        provider?: string;
        depth?: 'standard' | 'deep' | 'exhaustive';
    }): Promise<{
        sources: ResearchSource[];
        notes: ResearchNote[];
        assets: ResearchAsset[];
        id: string;
        queryId: string;
        userId: string;
        title: string;
        summary: string;
        researchOutline: Record<string, unknown>;
        researchMode: string;
        createdAt: Date;
        updatedAt: Date;
        query: ResearchQuery;
    }>;
    generateBareActAnalysis(userId: string, body: {
        queryId?: string;
        topic: string;
        researchMode: string;
        sources: string[];
        provider?: string;
        depth?: 'standard' | 'deep' | 'exhaustive';
    }): Promise<{
        sources: ResearchSource[];
        notes: ResearchNote[];
        assets: ResearchAsset[];
        id: string;
        queryId: string;
        userId: string;
        title: string;
        summary: string;
        researchOutline: Record<string, unknown>;
        researchMode: string;
        createdAt: Date;
        updatedAt: Date;
        query: ResearchQuery;
    }>;
    listJudgmentReports(userId: string, search?: string): Promise<{
        id: string;
        userId: string;
        researchTopic: string;
        caseName: string;
        citation: string;
        court: string;
        judge: string;
        facts: any;
        issues: any;
        holdings: any;
        ratioDecidendi: string;
        obiterDicta: string;
        reliefGranted: string;
        impactAnalysis: string;
        researchMatrix: any;
        generatedReport: string;
        fileName: string;
        metadata: any;
        title: string;
        summary: string;
        researchMode: string;
        sources: any[];
        notes: any[];
        assets: any[];
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getJudgmentReport(userId: string, id: string): Promise<{
        id: string;
        userId: string;
        researchTopic: string;
        caseName: string;
        citation: string;
        court: string;
        judge: string;
        facts: any;
        issues: any;
        holdings: any;
        ratioDecidendi: string;
        obiterDicta: string;
        reliefGranted: string;
        impactAnalysis: string;
        researchMatrix: any;
        generatedReport: string;
        fileName: string;
        metadata: any;
        title: string;
        summary: string;
        researchMode: string;
        sources: any[];
        notes: any[];
        assets: any[];
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteJudgmentReport(userId: string, id: string): Promise<{
        success: boolean;
    }>;
    getJudgmentAnalytics(userId: string): Promise<{
        totalJudgmentsGenerated: number;
        mostUsedCourts: {
            label: string;
            count: number;
        }[];
        mostResearchedTopics: {
            label: string;
            count: number;
        }[];
        mostUsedStatutes: {
            label: string;
            count: number;
        }[];
        mostUsedPrecedents: {
            label: string;
            count: number;
        }[];
    }>;
    private buildJudgmentIntelligence;
    private extractJudgmentSignals;
    private normalizeJudgmentAnalysis;
    private renderJudgmentReportMarkdown;
    private toJudgmentReportResponse;
    private stringifySection;
    private camel;
    private timelineFromText;
    private issueList;
    private argumentList;
    private ratioFromText;
    private buildLegalBrief;
    private extractLegalBriefSignals;
    private renderLegalBriefMarkdown;
    private sampleLegalBriefText;
    private buildBareActAnalysis;
    private extractBareActSignals;
    private renderBareActMarkdown;
    private sampleBareActText;
    private sampleJudgmentText;
    private detectTopicScope;
    private calculateRelevanceScore;
    private calculateTopicMatchScore;
    private calculateConfidenceScore;
    private generateLlmResponseWithFallback;
    generateReport(userId: string, body: {
        queryId?: string;
        topic: string;
        researchMode: string;
        sources: string[];
        provider?: string;
        depth?: 'standard' | 'deep' | 'exhaustive';
        selectedWorkspace?: string;
        detectedType?: string;
        pipeline?: string;
    }): Promise<any>;
    challengeReport(userId: string, reportId: string): Promise<{
        sources: ResearchSource[];
        notes: ResearchNote[];
        assets: ResearchAsset[];
        id: string;
        queryId: string;
        userId: string;
        title: string;
        summary: string;
        researchOutline: Record<string, unknown>;
        researchMode: string;
        createdAt: Date;
        updatedAt: Date;
        query: ResearchQuery;
    }>;
    private generatePointId;
    private retrieveContext;
    private seedWorkspace;
    private generateDetailedLegalText;
    private generateLocalFallbackReport;
    generateMentorStep(userId: string, body: {
        topic: string;
        stepIndex: number;
        researchPlan?: {
            areaOfLaw: string;
            steps: Array<{
                id: string;
                title: string;
                queryFocus: string;
                sourceFocus: string[];
            }>;
        };
    }): Promise<{
        researchPlan?: {
            areaOfLaw: string;
            steps: Array<{
                id: string;
                title: string;
                queryFocus: string;
                sourceFocus: string[];
            }>;
        };
        stepIndex: number;
        totalSteps: number;
        stepTitle: string;
        whatToDo: string;
        whyItMatters: string;
        mentorTip: string;
        authorities: {
            type: string;
            title: string;
            excerpt: string;
            source: string;
        }[];
        isLast: boolean;
        notebookPatch: any;
    }>;
    generateMentorMemo(userId: string, body: {
        topic: string;
        notebook: any;
    }): Promise<{
        memo: string;
    }>;
    private buildMentorPlan;
    private buildFallbackMentorPlan;
    private mentorRetrieve;
    private buildMentorStepContent;
    private generateLocalChallengeFallback;
}
