import { IngestionService, DocumentType } from './ingestion.service';
import { CorpusScannerService } from './corpus-scanner.service';
declare class IngestDocumentDto {
    documentType: DocumentType;
    filePath: string;
    metadata?: Record<string, any>;
    chunkSize?: number;
    chunkOverlap?: number;
}
declare class IngestTextDto {
    documentType: DocumentType;
    text: string;
    metadata?: Record<string, any>;
    chunkSize?: number;
    chunkOverlap?: number;
}
declare class IngestBatchDto {
    documentType: DocumentType;
    directoryPath: string;
    metadata?: Record<string, any>;
    chunkSize?: number;
    chunkOverlap?: number;
}
export declare class IngestionController {
    private readonly ingestionService;
    private readonly corpusScannerService;
    private readonly logger;
    constructor(ingestionService: IngestionService, corpusScannerService: CorpusScannerService);
    getStatus(): Promise<{
        success: boolean;
        status: import("./ingestion.service").PipelineStatus;
    }>;
    initCollections(): Promise<{
        success: boolean;
        message: string;
        created: string[];
    }>;
    ingestDocument(dto: IngestDocumentDto): Promise<{
        success: boolean;
        result: import("./ingestion.service").IngestionResult;
    }>;
    ingestText(dto: IngestTextDto): Promise<{
        success: boolean;
        result: import("./ingestion.service").IngestionResult;
    }>;
    ingestBatch(dto: IngestBatchDto): Promise<{
        success: boolean;
        result: import("./ingestion.service").BatchIngestionResult;
    }>;
    scanCorpus(): Promise<{
        success: boolean;
        actsDiscovered: number;
        actsParsed: number;
        actsSkipped: number;
        sectionsStored: number;
        embeddingsGenerated: number;
        missingEmbeddings: number;
        errors: number;
        details: {
            act: string;
            sections: number;
            embeddings: number;
            skipped: boolean;
            error?: string;
        }[];
    }>;
}
export {};
