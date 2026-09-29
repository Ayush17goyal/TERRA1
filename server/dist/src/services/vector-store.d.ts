import { EmbeddingService } from '../modules/retrieval/embedding.service';
export interface VectorStorePayload {
    [key: string]: any;
    document_id: string;
    chunk_id: string;
    document_type: string;
    user_id: string;
    source_file: string;
    chunk_index: number;
    confidence: number;
    quality_score: number;
    processed_at: string;
}
export declare class VectorStoreService {
    private embeddingService;
    private readonly logger;
    private client;
    private readonly collectionName;
    constructor(embeddingService: EmbeddingService);
    initializeCollection(): Promise<void>;
    storeChunks(documentId: string, chunks: Array<{
        id: string;
        text: string;
        chunkIndex: number;
        confidence: number;
        pageNumber?: number;
    }>, metadata: {
        document_type: string;
        user_id: string;
        source_file: string;
        quality_score: number;
    }): Promise<{
        success: boolean;
        chunksStored: number;
        vectorsGenerated: number;
        error?: string;
    }>;
    search(query: string, userId: string, limit?: number, scoreThreshold?: number): Promise<Array<{
        chunk_id: string;
        document_id: string;
        similarity: number;
        text: string;
        source_file: string;
    }>>;
    deleteDocument(documentId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    getDocumentStats(documentId: string): Promise<{
        vectorCount: number;
        avgConfidence: number;
        storageSize: number;
    }>;
    private generatePointId;
}
