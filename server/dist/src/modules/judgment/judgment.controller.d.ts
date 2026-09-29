import { JudgmentService } from './judgment.service';
export declare class JudgmentController {
    private readonly judgmentService;
    constructor(judgmentService: JudgmentService);
    analyzeJudgment(documentId: string, req: any): Promise<import("./judgment-analysis.entity").JudgmentAnalysis>;
    getAnalysis(documentId: string, req: any): Promise<import("./judgment-analysis.entity").JudgmentAnalysis>;
    explainMode(documentId: string, body: {
        mode: string;
    }, req: any): Promise<{
        mode: string;
        content: string;
        sourceRefs: any[];
    }>;
    evaluateVerdict(documentId: string, body: {
        userVerdict: string;
    }, req: any): Promise<{
        similarityPercentage: number;
        reasoningScore: number;
        feedback: string;
        actualVerdict: string;
        actualRatio: string;
        sourceRefs: any[];
    }>;
    generateRevisionNotes(documentId: string, req: any): Promise<{
        content: string;
        sourceRefs: any[];
    }>;
    generateMootCourtKit(documentId: string, req: any): Promise<{
        content: string;
        sourceRefs: any[];
    }>;
    generateAlternativeReasoning(documentId: string, req: any): Promise<{
        content: string;
    }>;
    getJudgmentMastery(documentId: string, body: {
        action: string;
    }, req: any): Promise<any>;
}
