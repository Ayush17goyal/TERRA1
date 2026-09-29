import { Repository } from 'typeorm';
import { Draft } from './entities/draft.entity';
import { SupabaseService } from '../settings/supabase.service';
import { ProgressService } from './services/progress.service';
import { ExtractionService } from './services/extraction.service';
import { AiReviewerService } from './services/ai-reviewer.service';
export declare class DraftAnalyzerService {
    private readonly draftRepo;
    private readonly supabaseService;
    private readonly progressService;
    private readonly extractionService;
    private readonly aiReviewer;
    private readonly logger;
    constructor(draftRepo: Repository<Draft>, supabaseService: SupabaseService, progressService: ProgressService, extractionService: ExtractionService, aiReviewer: AiReviewerService);
    upload(userId: string, file: {
        originalname: string;
        buffer: Buffer;
        size: number;
        mimetype: string;
    }): Promise<Draft>;
    getStatus(userId: string, draftId: string): Promise<Draft>;
    listHistory(userId: string): Promise<Draft[]>;
    getFileUrl(userId: string, draftId: string): Promise<{
        url: string | null;
        localFile?: boolean;
        fileName: string;
        mimeType: string;
    }>;
    getFileData(userId: string, draftId: string): Promise<{
        buffer: Buffer;
        mimeType: string;
    }>;
    analyzeInBackground(draftId: string, userId: string): Promise<void>;
    delete(userId: string, draftId: string): Promise<void>;
    private saveToLocalDisk;
    private validateFile;
}
