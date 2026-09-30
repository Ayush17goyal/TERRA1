import { CaseReasoningSimulatorService } from './case-reasoning-simulator.service';
type AuthenticatedRequest = {
    user: {
        id: string;
    };
};
type AnalyzeBody = {
    caseNameOrProblem?: string;
    studentReasoning?: string;
    studentSolution?: string;
};
export declare class CaseReasoningSimulatorController {
    private readonly simulator;
    constructor(simulator: CaseReasoningSimulatorService);
    analyze(req: AuthenticatedRequest, body: AnalyzeBody): Promise<{
        attemptId?: string;
        caseNameOrProblem: string;
        status: "evaluated" | "saved";
        createdAt: string;
        sections: {
            caseOverview: {
                caseName: string;
                natureOfDispute: string;
                areaOfLaw: string;
                keyLegalIssue: string;
                difficultyLevel: string;
            };
            understandingOfFacts: {
                summary: string;
                strengths: string[];
                gaps: string[];
                suggestions: string[];
            };
            issueIdentification: {
                summary: string;
                strengths: string[];
                gaps: string[];
                suggestions: string[];
            };
            applicableLaw: {
                summary: string;
                strengths: string[];
                gaps: string[];
                suggestions: string[];
            };
            caseLawAnalysis: {
                summary: string;
                strengths: string[];
                gaps: string[];
                suggestions: string[];
            };
            legalReasoning: {
                summary: string;
                strengths: string[];
                gaps: string[];
                suggestions: string[];
            };
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
            bestCaseReport: {
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
            performanceScore: {
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
        };
        professorComments: string;
        provider: string;
    }>;
    history(req: AuthenticatedRequest): Promise<{
        id: string;
        caseName: string;
        date: Date;
        score: any;
        status: string;
    }[]>;
    getAttempt(req: AuthenticatedRequest, id: string): Promise<{
        report: {
            attemptId?: string;
            caseNameOrProblem: string;
            status: "evaluated" | "saved";
            createdAt: string;
            sections: {
                caseOverview: {
                    caseName: string;
                    natureOfDispute: string;
                    areaOfLaw: string;
                    keyLegalIssue: string;
                    difficultyLevel: string;
                };
                understandingOfFacts: {
                    summary: string;
                    strengths: string[];
                    gaps: string[];
                    suggestions: string[];
                };
                issueIdentification: {
                    summary: string;
                    strengths: string[];
                    gaps: string[];
                    suggestions: string[];
                };
                applicableLaw: {
                    summary: string;
                    strengths: string[];
                    gaps: string[];
                    suggestions: string[];
                };
                caseLawAnalysis: {
                    summary: string;
                    strengths: string[];
                    gaps: string[];
                    suggestions: string[];
                };
                legalReasoning: {
                    summary: string;
                    strengths: string[];
                    gaps: string[];
                    suggestions: string[];
                };
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
                bestCaseReport: {
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
                performanceScore: {
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
            };
            professorComments: string;
            provider: string;
        };
        caseNameOrProblem: string;
        studentReasoning: any;
    }>;
    saveAttempt(req: AuthenticatedRequest, id: string): Promise<{
        success: boolean;
        status: string;
    }>;
}
export {};
