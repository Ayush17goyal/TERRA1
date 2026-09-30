import { Repository } from 'typeorm';
import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
import { SemanticCacheService } from '../chat/semantic-cache.service';
import { CaseSimulationSession } from './legal-intelligence.entities';
type CaseReasoningScores = {
    overallLegalReasoning: number;
    factIdentification: number;
    issueSpotting: number;
    lawApplication: number;
    caseLawUsage: number;
    professionalWriting: number;
    argumentQuality: number;
    criticalThinking: number;
    argumentStrength: number;
    finalScore: number;
    grade: string;
};
type SectionReport = {
    summary: string;
    strengths: string[];
    gaps: string[];
    suggestions: string[];
};
type CaseOverview = {
    caseName: string;
    natureOfDispute: string;
    areaOfLaw: string;
    keyLegalIssue: string;
    difficultyLevel: string;
};
type BestCaseReport = {
    title: string;
    introduction: string;
    facts: string[];
    issues: string[];
    applicableLaw: string[];
    caseLaw: string[];
    analysis: string;
    counterArguments: string[];
    conclusion: string;
    legalPrinciple: string;
    examReadyAnswer: string;
};
type CaseReasoningReport = {
    attemptId?: string;
    caseNameOrProblem: string;
    status: 'evaluated' | 'saved';
    createdAt: string;
    sections: {
        caseOverview: CaseOverview;
        understandingOfFacts: SectionReport;
        issueIdentification: SectionReport;
        applicableLaw: SectionReport;
        caseLawAnalysis: SectionReport;
        legalReasoning: SectionReport;
        simplifiedExplanation: {
            facts: string;
            issues: string;
            law: string;
            application: string;
            reasoning: string;
            courtReasoning: string;
            decision: string;
            ratiodecidendi: string;
            legalPrinciple: string;
            practicalApplication: string;
            examTips: string;
            realLifeExample: string;
        };
        mistakes: string[];
        professionalSolution: string;
        bestCaseReport: BestCaseReport;
        modelLegalAnswer: {
            issue: string;
            materialFacts: string;
            legalFramework: string;
            precedentApplication: string;
            petitionerCase: string;
            respondentCase: string;
            rebuttal: string;
            likelyJudicialApproach: string;
            conclusion: string;
            remedyRelief?: string;
            examTakeaway: string;
        };
        learningRecommendations: {
            whatStudentDidWell: string[];
            whatToImprove: string[];
            relatedBareActs: string[];
            relatedSections: string[];
            relatedCases: string[];
            relatedMockTests: string[];
            relatedFlashcards: string[];
            relatedResearchTopics: string[];
        };
        performanceScore: CaseReasoningScores;
    };
    professorComments: string;
    provider: string;
};
export declare class CaseReasoningSimulatorService {
    private readonly attemptsRepo;
    private readonly ai;
    private readonly cache;
    constructor(attemptsRepo: Repository<CaseSimulationSession>, ai: OpenRouterAiProviderService, cache: SemanticCacheService);
    analyze(userId: string, body: {
        caseNameOrProblem?: string;
        studentReasoning?: string;
        studentSolution?: string;
    }): Promise<CaseReasoningReport>;
    listHistory(userId: string): Promise<{
        id: string;
        caseName: string;
        date: Date;
        score: any;
        status: string;
    }[]>;
    getAttempt(userId: string, id: string): Promise<{
        report: CaseReasoningReport;
        caseNameOrProblem: string;
        studentReasoning: any;
    }>;
    saveAttempt(userId: string, id: string): Promise<{
        success: boolean;
        status: string;
    }>;
    private buildPrompt;
    private normalizeReport;
    private section;
    private localReport;
}
export {};
