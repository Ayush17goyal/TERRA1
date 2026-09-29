import { Repository, DataSource } from 'typeorm';
import { Draft } from '../entities/draft.entity';
import { DraftPage } from '../entities/draft-page.entity';
import { DraftTextBlock } from '../entities/draft-text-block.entity';
import { SupabaseService } from '../../settings/supabase.service';
import { PdfExtractorService } from './pdf-extractor.service';
import { DocxExtractorService } from './docx-extractor.service';
import { TxtExtractorService } from './txt-extractor.service';
import type { ExtractionResult } from './extraction.types';
import type { JobProgress } from './progress.service';
type ProgressCb = (patch: Partial<JobProgress>) => void;
export declare class ExtractionService {
    private readonly draftRepo;
    private readonly pageRepo;
    private readonly blockRepo;
    private readonly supabaseService;
    private readonly pdfExtractor;
    private readonly docxExtractor;
    private readonly txtExtractor;
    private readonly dataSource;
    private readonly logger;
    constructor(draftRepo: Repository<Draft>, pageRepo: Repository<DraftPage>, blockRepo: Repository<DraftTextBlock>, supabaseService: SupabaseService, pdfExtractor: PdfExtractorService, docxExtractor: DocxExtractorService, txtExtractor: TxtExtractorService, dataSource: DataSource);
    extract(draftId: string, userId: string): Promise<ExtractionResult>;
    extractWithProgress(draftId: string, userId: string, onProgress: ProgressCb): Promise<ExtractionResult>;
    getPages(draftId: string, userId: string): Promise<DraftPage[]>;
    getAllLineBlocks(draftId: string, userId: string): Promise<DraftTextBlock[]>;
    getPage(draftId: string, userId: string, pageNumber: number): Promise<{
        page: DraftPage;
        blocks: DraftTextBlock[];
    }>;
    private assertDraftOwner;
    private downloadFile;
    private runExtractor;
    private persistExtractionStreaming;
    private persistPageChunk;
}
export {};
