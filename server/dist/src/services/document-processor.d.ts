export interface DocumentMetadata {
    fileName: string;
    fileType: 'PDF' | 'DOCX' | 'TXT' | 'MD' | 'UNKNOWN';
    fileSize: number;
    uploadedAt: string;
    pageCount?: number;
    language?: string;
    isScanned?: boolean;
    confidence?: number;
    extractionMethod?: string;
}
export interface ExtractedContent {
    text: string;
    metadata: DocumentMetadata;
    isScanned: boolean;
    hasImages: boolean;
    language: string;
}
export interface DocumentChunk {
    id: string;
    text: string;
    pageNumber: number;
    chunkIndex: number;
    confidence: number;
    startOffset: number;
    endOffset: number;
}
export declare class DocumentProcessor {
    private readonly logger;
    extractFromPDF(buffer: Buffer, fileName: string): Promise<ExtractedContent>;
    extractFromDOCX(buffer: Buffer, fileName: string): Promise<ExtractedContent>;
    extractFromText(buffer: Buffer, fileName: string): Promise<ExtractedContent>;
    normalizeFileType(fileName: string, mimeType?: string): 'PDF' | 'DOCX' | 'TXT' | 'MD' | 'UNKNOWN';
    private isScannedPDF;
    private extractTextFromDocumentXml;
    createChunks(text: string, documentId: string, fileName: string, options?: {
        chunkSize?: number;
        overlapSize?: number;
    }): DocumentChunk[];
    validateExtraction(text: string, metadata: DocumentMetadata): {
        isValid: boolean;
        qualityScore: number;
        message: string;
    };
}
