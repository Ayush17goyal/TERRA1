import { VectorStoreService } from './vector-store';
import { EmbeddingService } from '../modules/retrieval/embedding.service';
export interface DocumentUploadDTO {
    documentId: string;
    fileName: string;
    documentType: string;
    extractedWordCount: number;
    chunkCount: number;
    qualityScore: number;
    vectorsStored: number;
    extractionStatus: string;
    message: string;
    previewContent: string;
}
export declare class DocumentUploadServiceNest {
    private embeddingService;
    private vectorStore;
    private readonly logger;
    private uploadService;
    constructor(embeddingService: EmbeddingService, vectorStore: VectorStoreService);
    handleUpload(fileBuffer: Buffer, fileName: string, documentType: string, userId: string): Promise<DocumentUploadDTO>;
    getUploadStatus(documentId: string, userId: string): Promise<{
        documentId: string;
        status: string;
        vectorCount: number;
        avgConfidence: number;
        storageSize: number;
    }>;
}
