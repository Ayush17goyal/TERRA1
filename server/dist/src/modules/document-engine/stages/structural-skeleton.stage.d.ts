import { CleanedDocument, DocumentTree } from '../types/document-graph.types';
export declare class StructuralSkeletonStage {
    build(doc: CleanedDocument): DocumentTree;
    private detectHeading;
    private classifyDocumentType;
}
