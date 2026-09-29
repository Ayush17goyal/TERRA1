import { DocumentProcessor, DocumentMetadata } from './document-processor';
import { VectorStoreService } from './vector-store';
export interface UploadResult {
    success: boolean;
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
    metadata: DocumentMetadata;
    error?: string;
}
export declare class DocumentUploadService {
    private documentProcessor;
    private vectorStore;
    constructor(documentProcessor: DocumentProcessor, vectorStore: VectorStoreService);
    processUpload(fileBuffer: Buffer, fileName: string, documentType: string, userId: string): Promise<UploadResult>;
    private generateDocumentId;
    countWords(text: string): number;
}
