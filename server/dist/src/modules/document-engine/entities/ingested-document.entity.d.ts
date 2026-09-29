import { DocumentEngineStatus, SourceDocumentType } from '../types/document-graph.types';
import { DocumentKnowledgeRecordEntity } from './document-knowledge-record.entity';
export declare class IngestedDocumentEntity {
    id: string;
    userId: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    contentHash: string;
    status: DocumentEngineStatus;
    documentType: SourceDocumentType;
    language: string;
    ocrUsed: boolean;
    confidenceScore: number;
    needsReview: boolean;
    reviewReasons: string[];
    stageProgress: Record<string, 'pending' | 'in_progress' | 'completed' | 'failed'>;
    errorMessage: string;
    documentTypeHint: string;
    knowledgeRecord: DocumentKnowledgeRecordEntity;
    createdAt: Date;
    updatedAt: Date;
}
