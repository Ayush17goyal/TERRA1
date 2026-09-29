import { LearningWorkspaceService } from './learning-workspace.service';
import { SettingsService } from '../settings/settings.service';
export declare class LearningWorkspaceController {
    private readonly service;
    private readonly settings;
    constructor(service: LearningWorkspaceService, settings: SettingsService);
    list(req: any): Promise<{
        sources: import("./learning-workspace.entities").AiLearningSource[];
        mockTests: import("./learning-workspace.entities").AiMockTest[];
        mindMaps: import("./learning-workspace.entities").AiMindMap[];
        studyKits: import("./learning-workspace.entities").AiStudyKit[];
        analytics: {
            documentsUploaded: number;
            mockTestsGenerated: number;
            mindMapsCreated: number;
            studyKitsGenerated: number;
            averageScore: number;
            topicsMastered: number;
            readinessScore: number;
        };
        weakAreas: {
            weakTopics: string[];
            strongTopics: string[];
            suggestedRevisionPlan: string[];
        };
        attempts: import("./learning-workspace.entities").AiMockTestAttempt[];
    }>;
    createTextSource(req: any, body: any): Promise<import("./learning-workspace.entities").AiLearningSource>;
    uploadSource(req: any, file: any, kind: string): Promise<import("./learning-workspace.entities").AiLearningSource>;
    uploadSources(req: any, files: any[], kind: string): Promise<{
        accepted: number;
        sources: import("./learning-workspace.entities").AiLearningSource[];
    }>;
    renameSource(req: any, id: string, newName: string): Promise<import("./learning-workspace.entities").AiLearningSource>;
    deleteSource(req: any, id: string): Promise<{
        success: boolean;
    }>;
    reprocessSource(req: any, id: string): Promise<import("./learning-workspace.entities").AiLearningSource>;
    generateMockTest(req: any, body: any): Promise<import("./learning-workspace.entities").AiMockTest>;
    generateDetailedAnswer(req: any, id: string, questionId: string, body: any): Promise<{
        questionId: string;
        mode: "10 Marks" | "15 Marks" | "20 Marks" | "Judiciary Style" | "Long Descriptive";
        answer: any;
        cached: boolean;
    }>;
    submitMockTest(req: any, id: string, body: any): Promise<import("./learning-workspace.entities").AiMockTestAttempt>;
    exportMockTest(req: any, id: string, format: string, res: any): Promise<void>;
    exportMockTestFromClient(req: any, body: any, format: string, res: any): Promise<void>;
    generateMindMap(req: any, body: any): Promise<import("./learning-workspace.entities").AiMindMap>;
    exportMindMap(req: any, id: string, format: string, res: any): Promise<void>;
    generateStudyKit(req: any, body: any): Promise<import("./learning-workspace.entities").AiStudyKit>;
    exportStudyKit(req: any, id: string, format: string, res: any): Promise<void>;
    reviewFlashcard(req: any, body: any): Promise<import("./learning-workspace.entities").AiFlashcardReview>;
    generateRevisionPlanner(req: any, durationDays: number): Promise<any>;
    weakAreas(req: any): Promise<{
        weakTopics: string[];
        strongTopics: string[];
        suggestedRevisionPlan: string[];
    }>;
    analytics(req: any): Promise<{
        documentsUploaded: number;
        mockTestsGenerated: number;
        mindMapsCreated: number;
        studyKitsGenerated: number;
        averageScore: number;
        topicsMastered: number;
        readinessScore: number;
    }>;
    pauseIndexing(): {
        success: boolean;
        status: string;
    };
    resumeIndexing(): {
        success: boolean;
        status: string;
    };
    getIndexingStatus(): {
        paused: boolean;
        queueLength: number;
        isProcessing: boolean;
        activeWorkers: number;
        maxWorkers: number;
    };
    private validateUploadedFile;
    private validateBulkUpload;
    private userId;
}
