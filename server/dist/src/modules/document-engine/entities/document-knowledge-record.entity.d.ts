import { IngestedDocumentEntity } from './ingested-document.entity';
import { DocumentGraph, RetrievableUnit } from '../types/document-graph.types';
export declare class DocumentKnowledgeRecordEntity {
    id: string;
    documentId: string;
    document: IngestedDocumentEntity;
    graph: DocumentGraph;
    retrievableUnits: RetrievableUnit[];
    dominantTopics: string[];
    createdAt: Date;
}
