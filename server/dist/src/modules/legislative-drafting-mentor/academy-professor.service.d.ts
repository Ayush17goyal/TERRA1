import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
export type AcademyLessonContent = {
    learningObjective: string;
    whyThisMatters: string;
    learn: string[];
    professionalInsight: string;
    observe: Array<{
        source: string;
        example: string;
        reasoning: string;
    }>;
    judgesLens: string;
    draftingPrinciple: string;
    beginnerMistakes: Array<{
        mistake: string;
        whyWrong: string;
        counselApproach: string;
    }>;
    guidedPractice: {
        task: string;
        steps: string[];
    };
    independentChallenge: string;
    masteryQuestion: string;
    keyTakeaways: string[];
    wordSelection?: Array<{
        chosen: string;
        alt: string;
        reason: string;
    }>;
};
export declare class AcademyProfessorService {
    private readonly ai;
    private readonly logger;
    private readonly CACHE_VERSION;
    private cache;
    constructor(ai: OpenRouterAiProviderService);
    lesson(userId: string, index: number): Promise<{
        meta: import("./academy-curriculum").AcademyLesson;
        content: AcademyLessonContent;
    }>;
    review(userId: string, index: number, answer: string): Promise<{
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
    mastery(userId: string, index: number, answer: string): Promise<{
        correct: boolean;
        feedback: string;
        hint: string;
    }>;
    generatePractice(userId: string, index: number, prompt: string, difficulty?: string): Promise<{
        questions: string;
    }>;
    private parse;
    private validateLesson;
    private parseEvaluation;
    private validateEvaluation;
    private stringArray;
    private fallback;
}
