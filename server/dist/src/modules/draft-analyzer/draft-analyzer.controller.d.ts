import type { Response } from 'express';
import { DraftAnalyzerService } from './draft-analyzer.service';
import { ExtractionService } from './services/extraction.service';
import { AiReviewerService } from './services/ai-reviewer.service';
import { ProgressService } from './services/progress.service';
export declare class DraftAnalyzerController {
    private readonly service;
    private readonly extractionService;
    private readonly aiReviewer;
    private readonly progressService;
    constructor(service: DraftAnalyzerService, extractionService: ExtractionService, aiReviewer: AiReviewerService, progressService: ProgressService);
    upload(file: any, req: any): Promise<import("./entities/draft.entity").Draft>;
    extract(id: string, req: any): Promise<import("./services/extraction.types").ExtractionResult>;
    listPages(id: string, req: any): Promise<import("./entities/draft-page.entity").DraftPage[]>;
    getPage(id: string, pageNum: number, req: any): Promise<{
        page: import("./entities/draft-page.entity").DraftPage;
        blocks: import("./entities/draft-text-block.entity").DraftTextBlock[];
    }>;
    review(id: string, req: any): Promise<import("./services/ai-reviewer.service").ReviewResult>;
    getReview(id: string, req: any): Promise<import("./entities/draft-review-finding.entity").DraftReviewFinding[]>;
    getAuditStatus(id: string, req: any): Promise<{
        scoreReady: boolean;
        auditScore: number | null;
        completionStatus: string;
        pipelineStages: unknown;
        stages: unknown;
        findingCount: number;
    }>;
    fileUrl(id: string, req: any): Promise<{
        url: string | null;
        localFile?: boolean;
        fileName: string;
        mimeType: string;
    }>;
    fileData(id: string, req: any, res: Response): Promise<void>;
    blocks(id: string, req: any): Promise<import("./entities/draft-text-block.entity").DraftTextBlock[]>;
    analyze(id: string, req: any): Promise<{
        started: boolean;
        draftId: string;
    }>;
    getProgress(id: string, req: any): Promise<import("./services/progress.service").JobProgress | {
        phase: "idle";
    }>;
    history(req: any): Promise<import("./entities/draft.entity").Draft[]>;
    status(id: string, req: any): Promise<import("./entities/draft.entity").Draft>;
    remove(id: string, req: any): Promise<{
        success: boolean;
    }>;
}
