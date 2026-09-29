import { Repository } from 'typeorm';
import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
import { AuthorityVerificationEngine } from '../chat/lexmentor/authority-verification-engine.service';
import { CitationGenerator } from '../chat/lexmentor/citation-generator.service';
import { SemanticCacheService } from '../chat/semantic-cache.service';
import { QdrantService } from '../retrieval/qdrant.service';
import { BgeM3Provider } from '../retrieval/bge-m3.provider';
import { LegalRetrievalService } from '../retrieval/legal-retrieval.service';
import { ParsedProvisionEntity } from '../ingestion/entities/parsed-provision.entity';
import { DraftingAcademyCheck, DraftingAcademyCourse, LegalAuthorityVerification, LegalResearchGuideSession, CaseSimulationSession, ResearchMentorSession } from './legal-intelligence.entities';
export declare function cleanString(str: string | undefined | null): string;
export declare function cleanListItem(str: string | undefined | null): string;
export declare class LegalIntelligenceService {
    private readonly verificationRepo;
    private readonly guideRepo;
    private readonly courseRepo;
    private readonly draftCheckRepo;
    private readonly sessionRepo;
    private readonly mentorSessionRepo;
    private readonly ai;
    private readonly cache;
    private readonly qdrantService;
    private readonly bgeM3Provider;
    private readonly authorityVerificationEngine;
    private readonly citationGenerator;
    private readonly parsedProvisionRepository;
    private readonly legalRetrievalService;
    private readonly logger;
    constructor(verificationRepo: Repository<LegalAuthorityVerification>, guideRepo: Repository<LegalResearchGuideSession>, courseRepo: Repository<DraftingAcademyCourse>, draftCheckRepo: Repository<DraftingAcademyCheck>, sessionRepo: Repository<CaseSimulationSession>, mentorSessionRepo: Repository<ResearchMentorSession>, ai: OpenRouterAiProviderService, cache: SemanticCacheService, qdrantService: QdrantService, bgeM3Provider: BgeM3Provider, authorityVerificationEngine: AuthorityVerificationEngine, citationGenerator: CitationGenerator, parsedProvisionRepository: Repository<ParsedProvisionEntity>, legalRetrievalService: LegalRetrievalService);
    verifyAuthority(userId: string, body: {
        query?: string;
        answer?: string;
        citations?: any[];
        retrievedAuthorities?: any[];
        verification?: any;
    }): Promise<any>;
    createResearchGuide(userId: string, proposition: string): Promise<any>;
    checkDraft(userId: string, body: {
        text?: string;
        fileName?: string;
        inputType?: string;
    }): Promise<any>;
    listCourses(): Promise<DraftingAcademyCourse[]>;
    upsertCourse(body: Partial<DraftingAcademyCourse>): Promise<DraftingAcademyCourse>;
    deleteCourse(id: string): Promise<{
        success: boolean;
    }>;
    private extractCitations;
    private localAuthorityVerification;
    private localResearchRoadmap;
    private localDraftCheck;
    explainBareAct(userId: string, body: {
        actName: string;
        chapter: string;
        part?: string;
        section: string;
    }): Promise<{
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
    simplifyBareAct(userId: string, body: {
        actName: string;
        chapter: string;
        section: string;
        clause?: string;
    }): Promise<{
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
    analyzeBareActIntelligence(userId: string, body: {
        provisionText: string;
        actName?: string;
        sectionRef?: string;
    }): Promise<any>;
    professorTeach(userId: string, body: {
        provisionText: string;
        actName?: string;
        sectionRef?: string;
        step: number;
        action: 'teach' | 'doubt' | 'example' | 'simpler' | 'deeper' | 'court' | 'exam' | 'quiz_answer';
        userMessage?: string;
        sessionContext?: string;
        quizAnswer?: string;
    }): Promise<any>;
    private localExplainBareAct;
    private localSimplifyBareAct;
    private static readonly BARE_ACT_STYLES;
    private detectBareActTeachingStyle;
    private buildBareActStyleFragment;
    private buildBareActIdentityFragment;
    private buildBareActRetrievedContextFragment;
    private buildBareActConversationContextFragment;
    private buildBareActResponseValidationFragment;
    private buildBareActTeachingMethodologyFragment;
    private buildBareActResponseStructureFragment;
    private buildBareActTerminologyFragment;
    private assembleBareActSystemPrompt;
    private buildBareActExtractiveFallbackPrompt;
    private buildBareActTemplateExplanation;
    private bareActGenerateWithDegradation;
    professorChat(userId: string, body: {
        userInput: string;
        history?: {
            role: 'user' | 'assistant';
            content: string;
        }[];
    }): Promise<{
        response: string;
        act: string;
        source: string;
        lowConfidence: boolean;
    }>;
    analyzeCaseReasoning(userId: string, body: {
        caseNameOrProblem: string;
        studentSolution: string;
    }): Promise<any>;
    private localAnalyzeCase;
    researchMentorIntro(userId: string, topic: string): Promise<{
        areaOfLaw: string;
        explanation: string;
        importance: string;
        mentorIntroduction: string;
    }>;
    researchMentorStep(userId: string, topic: string, stepNumber: number): Promise<{
        stepNumber: number;
        title: string;
        coreQuestion: string;
        whyThisStep: string;
        whatAdvocateDoes: string;
        appliedExample: string;
        commonMistakes: any;
        mentorNote: string;
    }>;
    researchMentorGenerate(userId: string, topic: string): Promise<{
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
    researchMentorEvaluate(userId: string, body: {
        topic: string;
        stepNumber: number;
        stepName: string;
        userAnswer: string;
        isLastStep: boolean;
    }): Promise<{
        isCorrect: boolean;
        feedback: string;
        strengths: string;
        improvements: string;
        nextStepTask: string;
        nextStepHint: string;
        finalSummary: any;
    }>;
    researchMentorSessionStart(userId: string, topic: string): Promise<{
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
    researchMentorSessionGet(userId: string, sessionId: string): Promise<any>;
    conductResearchAssistant(userId: string, question: string): Promise<{
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
    private detectTopicContext;
    private buildMentorSessionFallback;
    private isBareActGreeting;
    bareActAiBar(userId: string, body: {
        provisionText: string;
        history?: {
            role: 'user' | 'assistant';
            content: string;
        }[];
    }): Promise<{
        markdown: string;
        act: string;
        source: string;
        lowConfidence: boolean;
    }>;
    private loadBareActDraftingSample;
    private classifyDraftingIntent;
    private extractExistingActName;
    private buildExistingLawDraftingFallback;
    private buildBareActSampleProfile;
    howToWriteBareAct(userId: string, body: {
        provisionText: string;
        actName?: string;
        sectionRef?: string;
    }): Promise<{
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
    formatAutoTitle(query: string): string;
    formatPreview(text: string): string;
    getConversations(userId: string): Promise<any[]>;
    saveConversation(userId: string, body: any): Promise<any>;
    saveMessage(userId: string, body: any): Promise<any>;
    deleteConversation(userId: string, id: string): Promise<{
        success: boolean;
    }>;
    getMessages(userId: string, id: string): Promise<any>;
    renameConversation(userId: string, id: string, title: string): Promise<{
        success: boolean;
    }>;
    private mockConversations;
    private mockMessages;
}
