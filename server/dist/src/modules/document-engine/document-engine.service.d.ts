import { Repository } from 'typeorm';
import { IngestedDocumentEntity } from './entities/ingested-document.entity';
import { DocumentKnowledgeRecordEntity } from './entities/document-knowledge-record.entity';
import { DuplicateDetectionGate } from './gates/duplicate-detection.gate';
import { DocumentEngineQueueService } from './document-engine-queue.service';
import { VirusScannerService } from '../../hardening/security/virus-scanner.service';
export interface UploadedFileLike {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}
export declare class DocumentEngineService {
    private readonly documents;
    private readonly knowledgeRecords;
    private readonly duplicateGate;
    private readonly queue;
    private readonly virusScanner;
    constructor(documents: Repository<IngestedDocumentEntity>, knowledgeRecords: Repository<DocumentKnowledgeRecordEntity>, duplicateGate: DuplicateDetectionGate, queue: DocumentEngineQueueService, virusScanner: VirusScannerService);
    submit(userId: string, file: UploadedFileLike, documentTypeHint?: string): Promise<IngestedDocumentEntity>;
    listForUser(userId: string): Promise<IngestedDocumentEntity[]>;
    getStatus(userId: string, documentId: string): Promise<IngestedDocumentEntity>;
    getKnowledgeRecord(userId: string, documentId: string): Promise<DocumentKnowledgeRecordEntity>;
    private safePathSegment;
}
