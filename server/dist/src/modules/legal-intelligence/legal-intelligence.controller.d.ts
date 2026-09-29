import { LegalIntelligenceService } from './legal-intelligence.service';
export declare class LegalIntelligenceController {
    private readonly service;
    constructor(service: LegalIntelligenceService);
    verifyAuthority(req: any, body: any): Promise<any>;
    createResearchGuide(req: any, proposition: string): Promise<any>;
    checkDraft(req: any, body: any): Promise<any>;
    explainBareAct(req: any, body: any): Promise<{
        purpose: string;
        importantKeywords: {
            word: string;
            explanation: string;
        }[];
        legislativeIntent: string;
        commonMistakes: {
            mistake: string;
            explanation: string;
        }[];
        memoryTricks: string[];
        realLifeIllustrations: string[];
        landmarkJudgments: {
            caseName: string;
            citation: string;
            ratio: string;
        }[];
        relatedProvisions: {
            provision: string;
            relationship: string;
        }[];
        examQuestions: string[];
        mootCourtRelevance: string;
        lawyerTips: string[];
        provider: string;
    }>;
    simplifyBareAct(req: any, body: any): Promise<{
        oneLineSummary: string;
        originalText: string;
        plainEnglishText: string;
        detailedExplanation: string;
        visualFlowText: string;
        keyPoints: string[];
        exceptions: string[];
        caseLaws: {
            caseName: string;
            principle: string;
        }[];
        relatedSections: string[];
        importantLegalTerms: {
            term: string;
            definition: string;
        }[];
        examNotes: string[];
        faqs: {
            question: string;
            answer: string;
        }[];
        provider: string;
    }>;
    professorChat(req: any, body: any): Promise<{
        response: string;
        act: string;
        source: string;
        lowConfidence: boolean;
    }>;
    analyzeBareActIntelligence(req: any, body: any): Promise<any>;
    professorTeach(req: any, body: any): Promise<any>;
    bareActAiBar(req: any, body: any): Promise<{
        markdown: string;
        act: string;
        source: string;
        lowConfidence: boolean;
    }>;
    howToWriteBareAct(req: any, body: any): Promise<{
        topic: string;
        draftingIntent: string;
        draftingIntentLabel: string;
        existingLaw: string;
        shouldCreateNewAct: boolean;
        learningObjective: string;
        overview: string;
        draftingPlan: string[];
        arrangementOfSections: any[];
        steps: {
            stepNumber: number;
            title: string;
            instruction: string;
            tip: string;
            example: string;
        }[];
        draftingPrinciples: string[];
        commonMistakes: string[];
        practiceTask: string;
        sampleStyleNote: string;
        provider: string;
    } | {
        topic: string;
        draftingIntent: string;
        draftingIntentLabel: string;
        existingLaw: any;
        shouldCreateNewAct: boolean;
        learningObjective: string;
        overview: string;
        draftingPlan: string[];
        arrangementOfSections: string[];
        steps: {
            stepNumber: number;
            title: string;
            instruction: string;
            tip: string;
            example: string;
        }[];
        draftingPrinciples: string[];
        commonMistakes: string[];
        practiceTask: string;
        sampleStyleNote: string;
        provider: string;
    } | {
        topic: string;
        draftingIntent: string;
        draftingIntentLabel: string;
        existingLaw: any;
        shouldCreateNewAct: boolean;
        learningObjective: string;
        overview: string;
        draftingPlan: any;
        arrangementOfSections: any;
        steps: {
            stepNumber: number;
            title: string;
            instruction: string;
            tip: string;
            example: string;
        }[];
        draftingPrinciples: any;
        commonMistakes: any;
        practiceTask: string;
        sampleStyleNote: string;
        finalTemplate: any;
        provider: string;
    }>;
    listCourses(): Promise<import("./legal-intelligence.entities").DraftingAcademyCourse[]>;
    upsertCourse(body: any): Promise<import("./legal-intelligence.entities").DraftingAcademyCourse>;
    deleteCourse(id: string): Promise<{
        success: boolean;
    }>;
    analyzeCaseReasoning(req: any, body: any): Promise<any>;
    researchMentorIntro(req: any, topic: string): Promise<{
        areaOfLaw: string;
        explanation: string;
        importance: string;
        mentorIntroduction: string;
    }>;
    researchMentorStep(req: any, body: any): Promise<{
        stepNumber: number;
        title: string;
        coreQuestion: string;
        whyThisStep: string;
        whatAdvocateDoes: string;
        appliedExample: string;
        commonMistakes: any;
        mentorNote: string;
    }>;
    researchMentorGenerate(req: any, topic: string): Promise<{
        legalIssue: string;
        areaOfLaw: string;
        governingStatutes: string;
        relevantProvisions: string;
        leadingJudgments: string;
        caseAnalysis: string;
        applicationToFacts: string;
        conclusion: string;
        practicePoints: any;
    }>;
    researchMentorSessionStart(req: any, topic: string): Promise<{
        intro: {
            areaOfLaw: string;
            explanation: string;
            importance: string;
            mentorIntroduction: string;
        };
        stages: {
            stepNumber: number;
            title: string;
            coreQuestion: string;
            introduction: string;
            coreConcept: string;
            workflow: string[];
            appliedExample: string;
            commonMistakes: string[];
            practicalTips: string[];
            checklist: string[];
            transitionSentence: string;
        }[];
        finalMemo: {
            legalIssue: string;
            areaOfLaw: string;
            governingStatutes: string;
            relevantProvisions: string;
            leadingJudgments: string;
            caseAnalysis: string;
            applicationToFacts: string;
            conclusion: string;
            practicePoints: string[];
        };
        sessionId: string;
        topic: string;
    }>;
    researchMentorSessionGet(req: any, id: string): Promise<any>;
    conductResearchAssistant(req: any, question: string): Promise<{
        executionStatus: string;
        executionAudit: {
            executionId: string;
            correlationId: string;
            overallStatus: string;
            progress: number;
            executionTimeMs: number;
            failureBatch: string;
            failureStage: string;
            failureStageIndex: number;
            failureCategory: string;
            rootCause: string;
            errorMessage: string;
            retryAttempts: number;
            fallbackAttempted: boolean;
            recoverySucceeded: boolean;
            recommendation: string;
            nextAction: string;
            stages: any[];
        };
    } | {
        executionStatus: string;
        sessionId: string;
        question: string;
        areaOfLaw: any;
        jurisdiction: any;
        researchLog: any;
        stages: any[];
        finalMemorandum: any;
        provider: string;
        model: string;
        executionAudit: {
            executionId: string;
            correlationId: string;
            overallStatus: string;
            progress: number;
            executionTimeMs: number;
            stages: any[];
        };
    }>;
    getConversations(req: any): Promise<any[]>;
    saveConversation(req: any, body: any): Promise<any>;
    saveMessage(req: any, body: any): Promise<any>;
    deleteConversation(req: any, id: string): Promise<{
        success: boolean;
    }>;
    getMessages(req: any, id: string): Promise<any>;
    renameConversation(req: any, id: string, title: string): Promise<{
        success: boolean;
    }>;
}
