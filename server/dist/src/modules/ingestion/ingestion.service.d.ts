import { QdrantService } from '../retrieval/qdrant.service';
import { BgeM3Provider } from '../retrieval/bge-m3.provider';
import { SemanticCacheService } from '../chat/semantic-cache.service';
import { type ChunkerOptions } from './legal-chunker';
export type DocumentType = 'constitution' | 'bare_acts' | 'supreme_court_cases' | 'high_court_cases' | 'research_papers' | 'user_documents' | 'bns' | 'bnss' | 'act' | 'judgment' | 'paper';
export interface IngestionResult {
    documentId: string;
    documentType: DocumentType;
    fileName: string;
    chunksGenerated: number;
    pointsUpserted: number;
    errors: string[];
    durationMs: number;
}
export interface BatchIngestionResult {
    totalDocuments: number;
    successful: number;
    failed: number;
    results: IngestionResult[];
    totalDurationMs: number;
}
export interface CollectionStats {
    name: string;
    pointCount: number;
    status: string;
}
export interface PipelineStatus {
    bgeM3Healthy: boolean;
    bgeM3Model: string | null;
    qdrantConnected: boolean;
    collections: CollectionStats[];
}
export declare class IngestionService {
    private readonly qdrantService;
    private readonly bgeM3Provider;
    private readonly cacheService;
    private readonly logger;
    private readonly UPSERT_BATCH_SIZE;
    constructor(qdrantService: QdrantService, bgeM3Provider: BgeM3Provider, cacheService: SemanticCacheService);
    getStatus(): Promise<PipelineStatus>;
    initializeCollections(): Promise<string[]>;
    ingestDocument(documentType: DocumentType, filePath: string, metadata?: Record<string, any>, chunkerOpts?: ChunkerOptions): Promise<IngestionResult>;
    ingestText(documentType: DocumentType, text: string, metadata?: Record<string, any>, chunkerOpts?: ChunkerOptions): Promise<IngestionResult>;
    ingestDirectory(documentType: DocumentType, dirPath: string, metadata?: Record<string, any>, chunkerOpts?: ChunkerOptions): Promise<BatchIngestionResult>;
    private ingestRawText;
    private chunkDocument;
    private readFile;
    private generateEmbeddingsViaBgeM3;
    private upsertToQdrant;
    private generateDocumentId;
    private generatePointId;
}
