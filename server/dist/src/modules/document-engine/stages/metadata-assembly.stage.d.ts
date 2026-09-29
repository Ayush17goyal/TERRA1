import { DocumentGraph, KnowledgeBaseRecord, SourceDocumentType } from '../types/document-graph.types';
export interface MetadataAssemblyInput {
    documentId: string;
    documentType: SourceDocumentType;
    documentTypeConfidence: number;
    language: string;
    languageFlag?: string;
    ocrUnavailableReason?: string;
    graph: DocumentGraph;
}
export declare class MetadataAssemblyStage {
    assemble(input: MetadataAssemblyInput): KnowledgeBaseRecord;
    private computeDominantTopics;
}
