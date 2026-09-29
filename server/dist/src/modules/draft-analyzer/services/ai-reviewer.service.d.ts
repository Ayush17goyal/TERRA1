import { Repository, DataSource } from 'typeorm';
import { Draft } from '../entities/draft.entity';
import { DraftPage } from '../entities/draft-page.entity';
import { DraftTextBlock } from '../entities/draft-text-block.entity';
import { DraftReviewFinding } from '../entities/draft-review-finding.entity';
import { OpenRouterAiProviderService } from '../../chat/openrouter-ai-provider.service';
import { ProgressService } from './progress.service';
import type { JobProgress } from './progress.service';
type ProgressCb = (patch: Partial<JobProgress>) => void;
export interface ReviewResult {
    draftId: string;
    pageCount: number;
    batchCount: number;
    findingCount: number;
    findings: DraftReviewFinding[];
    auditScore: number;
    scoreReady: boolean;
}
export declare class AiReviewerService {
    private readonly draftRepo;
    private readonly pageRepo;
    private readonly blockRepo;
    private readonly findingRepo;
    private readonly aiProvider;
    private readonly dataSource;
    private readonly progressService;
    private readonly logger;
    constructor(draftRepo: Repository<Draft>, pageRepo: Repository<DraftPage>, blockRepo: Repository<DraftTextBlock>, findingRepo: Repository<DraftReviewFinding>, aiProvider: OpenRouterAiProviderService, dataSource: DataSource, progressService: ProgressService);
    review(draftId: string, userId: string): Promise<ReviewResult>;
    reviewWithProgress(draftId: string, userId: string, onProgress: ProgressCb): Promise<ReviewResult>;
    getFindings(draftId: string, userId: string): Promise<DraftReviewFinding[]>;
    getAuditStatus(draftId: string, userId: string): Promise<{
        scoreReady: boolean;
        auditScore: number | null;
        completionStatus: string;
        pipelineStages: unknown;
        stages: unknown;
        findingCount: number;
    }>;
    private runGovtVerificationTask;
    private runLegalSearchTask;
    private runGptReasoningTask;
    private deduplicateFindings;
    private buildPageLinesForBatch;
    private batchPagesByRawText;
    private reviewBatchWithRetry;
    private reviewBatch;
    private parseAndValidate;
    private validateFinding;
    private repairAndParse;
    private persistFindingsChunk;
    private runStructuralValidation;
    private runCrossReferenceValidation;
    private inferDocType;
}
export {};
