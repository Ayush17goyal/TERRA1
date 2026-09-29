import { ResearchService } from './research.service';
import { SettingsService } from '../settings/settings.service';
export declare class ResearchController {
    private readonly research;
    private readonly settings;
    constructor(research: ResearchService, settings: SettingsService);
    private userId;
    createQuery(req: any, body: {
        topic: string;
        researchMode: string;
    }): Promise<{
        query: import("./research.entities").ResearchQuery;
        report: {
            sources: import("./research.entities").ResearchSource[];
            notes: import("./research.entities").ResearchNote[];
            assets: import("./research.entities").ResearchAsset[];
            id: string;
            queryId: string;
            userId: string;
            title: string;
            summary: string;
            researchOutline: Record<string, unknown>;
            researchMode: string;
            createdAt: Date;
            updatedAt: Date;
            query: import("./research.entities").ResearchQuery;
        };
    }>;
    listQueries(req: any): Promise<import("./research.entities").ResearchQuery[]>;
    getQuery(req: any, id: string): Promise<import("./research.entities").ResearchQuery>;
    createReport(req: any, body: any): Promise<import("./research.entities").ResearchReport>;
    getReport(req: any, id: string): Promise<{
        sources: import("./research.entities").ResearchSource[];
        notes: import("./research.entities").ResearchNote[];
        assets: import("./research.entities").ResearchAsset[];
        id: string;
        queryId: string;
        userId: string;
        title: string;
        summary: string;
        researchOutline: Record<string, unknown>;
        researchMode: string;
        createdAt: Date;
        updatedAt: Date;
        query: import("./research.entities").ResearchQuery;
    }>;
    updateReport(req: any, id: string, body: any): Promise<{
        sources: import("./research.entities").ResearchSource[];
        notes: import("./research.entities").ResearchNote[];
        assets: import("./research.entities").ResearchAsset[];
        id: string;
        queryId: string;
        userId: string;
        title: string;
        summary: string;
        researchOutline: Record<string, unknown>;
        researchMode: string;
        createdAt: Date;
        updatedAt: Date;
        query: import("./research.entities").ResearchQuery;
    }>;
    deleteReport(req: any, id: string): Promise<{
        success: boolean;
    }>;
    createNote(req: any, body: {
        reportId: string;
        title: string;
        content: string;
    }): Promise<import("./research.entities").ResearchNote>;
    getNote(req: any, id: string): Promise<import("./research.entities").ResearchNote>;
    updateNote(req: any, id: string, body: any): Promise<import("./research.entities").ResearchNote>;
    deleteNote(req: any, id: string): Promise<{
        success: boolean;
    }>;
    createSource(req: any, body: any): Promise<import("./research.entities").ResearchSource>;
    getSource(req: any, id: string): Promise<import("./research.entities").ResearchSource>;
    deleteSource(req: any, id: string): Promise<{
        success: boolean;
    }>;
    saveReport(req: any, body: {
        reportId: string;
    }): Promise<import("./research.entities").SavedReport>;
    listSavedReports(req: any): Promise<import("./research.entities").SavedReport[]>;
    deleteSavedReport(req: any, id: string): Promise<{
        success: boolean;
    }>;
    createAsset(req: any, body: any): Promise<import("./research.entities").ResearchAsset>;
    uploadFile(req: any, file: any, body: {
        queryId?: string;
        docCategory: string;
    }): Promise<import("./research.entities").ResearchDocument>;
    getDocuments(req: any, queryId: string): Promise<import("./research.entities").ResearchDocument[]>;
    generateResearch(req: any, body: {
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
    generateJudgmentIntelligence(req: any, body: {
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
    generateLegalBrief(req: any, body: {
        queryId?: string;
        topic: string;
        researchMode: string;
        sources: string[];
        provider?: string;
        depth?: 'standard' | 'deep' | 'exhaustive';
    }): Promise<{
        sources: import("./research.entities").ResearchSource[];
        notes: import("./research.entities").ResearchNote[];
        assets: import("./research.entities").ResearchAsset[];
        id: string;
        queryId: string;
        userId: string;
        title: string;
        summary: string;
        researchOutline: Record<string, unknown>;
        researchMode: string;
        createdAt: Date;
        updatedAt: Date;
        query: import("./research.entities").ResearchQuery;
    }>;
    generateBareActAnalysis(req: any, body: {
        queryId?: string;
        topic: string;
        researchMode: string;
        sources: string[];
        provider?: string;
        depth?: 'standard' | 'deep' | 'exhaustive';
    }): Promise<{
        sources: import("./research.entities").ResearchSource[];
        notes: import("./research.entities").ResearchNote[];
        assets: import("./research.entities").ResearchAsset[];
        id: string;
        queryId: string;
        userId: string;
        title: string;
        summary: string;
        researchOutline: Record<string, unknown>;
        researchMode: string;
        createdAt: Date;
        updatedAt: Date;
        query: import("./research.entities").ResearchQuery;
    }>;
    listJudgmentReports(req: any, search?: string): Promise<{
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
    judgmentAnalytics(req: any): Promise<{
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
    getJudgmentReport(req: any, id: string): Promise<{
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
    deleteJudgmentReport(req: any, id: string): Promise<{
        success: boolean;
    }>;
    getMentorStep(req: any, body: {
        topic: string;
        stepIndex: number;
        researchPlan?: any;
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
    getMentorMemo(req: any, body: {
        topic: string;
        notebook: any;
    }): Promise<{
        memo: string;
    }>;
    challengeResearch(req: any, body: {
        reportId: string;
    }): Promise<{
        sources: import("./research.entities").ResearchSource[];
        notes: import("./research.entities").ResearchNote[];
        assets: import("./research.entities").ResearchAsset[];
        id: string;
        queryId: string;
        userId: string;
        title: string;
        summary: string;
        researchOutline: Record<string, unknown>;
        researchMode: string;
        createdAt: Date;
        updatedAt: Date;
        query: import("./research.entities").ResearchQuery;
    }>;
}
