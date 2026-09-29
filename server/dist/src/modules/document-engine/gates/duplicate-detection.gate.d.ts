import { Repository } from 'typeorm';
import { IngestedDocumentEntity } from '../entities/ingested-document.entity';
import { GateResult } from '../types/document-graph.types';
export declare class DuplicateDetectionGate {
    private readonly documents;
    constructor(documents: Repository<IngestedDocumentEntity>);
    hash(buffer: Buffer): string;
    check(userId: string, contentHash: string): Promise<GateResult & {
        existing?: IngestedDocumentEntity;
    }>;
}
