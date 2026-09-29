import { Repository } from 'typeorm';
import { JudgmentAnalysis } from './judgment-analysis.entity';
import { DocumentChunk } from '../notebook/chunk.entity';
import { NotebookDocument } from '../notebook/notebook.entity';
import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
import { TokenOptimizationService } from '../chat/token-optimization.service';
import { SemanticCacheService } from '../chat/semantic-cache.service';
export declare class JudgmentService {
    private readonly analysisRepo;
    private readonly chunkRepo;
    private readonly docRepo;
    private readonly aiProvider;
    private readonly tokenService;
    private readonly cacheService;
    private readonly logger;
    constructor(analysisRepo: Repository<JudgmentAnalysis>, chunkRepo: Repository<DocumentChunk>, docRepo: Repository<NotebookDocument>, aiProvider: OpenRouterAiProviderService, tokenService: TokenOptimizationService, cacheService: SemanticCacheService);
    analyzeJudgment(documentId: string, userId: string): Promise<JudgmentAnalysis>;
    getAnalysis(documentId: string, userId: string): Promise<JudgmentAnalysis>;
    explainLike(documentId: string, mode: string, userId: string): Promise<{
        mode: string;
        content: string;
        sourceRefs: any[];
    }>;
    evaluateVerdict(documentId: string, userVerdict: string, userId: string): Promise<{
        similarityPercentage: number;
        reasoningScore: number;
        feedback: string;
        actualVerdict: string;
        actualRatio: string;
        sourceRefs: any[];
    }>;
    generateRevisionNotes(documentId: string, userId: string): Promise<{
        content: string;
        sourceRefs: any[];
    }>;
    generateMootCourtKit(documentId: string, userId: string): Promise<{
        content: string;
        sourceRefs: any[];
    }>;
    generateAlternativeReasoning(documentId: string, userId: string): Promise<{
        content: string;
    }>;
    private extractJudgmentStructure;
    private buildSourceChunkRefs;
    private buildAnalysisContext;
    getJudgmentMastery(documentId: string, action: string, userId: string): Promise<any>;
}
