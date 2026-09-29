import { DraftingWorkflowEngineService } from './drafting-workflow-engine.service';
import { AcademyProfessorService } from './academy-professor.service';
export declare class LegislativeDraftingMentorController {
    private readonly workflowEngine;
    private readonly professor;
    private readonly logger;
    constructor(workflowEngine: DraftingWorkflowEngineService, professor: AcademyProfessorService);
    getAcademyCurriculum(): import("./academy-curriculum").AcademyLesson[];
    getAcademyLesson(req: any, index: string): Promise<{
        meta: import("./academy-curriculum").AcademyLesson;
        content: import("./academy-professor.service").AcademyLessonContent;
    }>;
    reviewAcademyDraft(req: any, index: string, answer: string): Promise<{
        status: "correct" | "partial" | "incorrect";
        overallScore: any;
        conceptUnderstanding: any;
        legalAccuracy: any;
        draftingLogic: any;
        professionalLanguage: any;
        structuralLogic: any;
        strengths: string[];
        mistakes: string[];
        weakConcepts: any;
        feedback: string;
        improvedAnswer: string;
        unlockNextLesson: boolean;
        lessonCompleted: boolean;
        needsRevision: boolean;
        xpAward: number;
    }>;
    gradeAcademyMastery(req: any, index: string, answer: string): Promise<{
        correct: boolean;
        feedback: string;
        hint: string;
    }>;
    generatePractice(req: any, index: string, prompt: string, difficulty?: string): Promise<{
        questions: string;
    }>;
    getAcademyState(req: any): Promise<{
        state: Record<string, unknown>;
        version: number;
        updatedAt: Date;
        lastActivityAt: Date;
    }>;
    syncAcademyState(req: any, body: any): Promise<{
        conflict: boolean;
        state: Record<string, unknown>;
        version: number;
        updatedAt: Date;
    }>;
    getLessonCatalog(): import("./lesson-catalog").DraftingLesson[];
    createSession(req: any, topic: string): Promise<import("./drafting-workflow-engine.service").DraftingSessionView>;
    listSessions(req: any): Promise<import("./drafting-workflow-engine.service").DraftingSessionView[]>;
    resumeSession(req: any, id: string): Promise<import("./drafting-workflow-engine.service").DraftingSessionView>;
    advance(req: any, id: string): Promise<import("./drafting-workflow-engine.service").DraftingSessionView>;
    goBack(req: any, id: string): Promise<import("./drafting-workflow-engine.service").DraftingSessionView>;
    goToLesson(req: any, id: string, lessonIndex: number): Promise<import("./drafting-workflow-engine.service").DraftingSessionView>;
}
