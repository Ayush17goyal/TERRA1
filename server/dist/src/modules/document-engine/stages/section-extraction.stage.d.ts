import { CleanedDocument, DocumentTree, SectionNode } from '../types/document-graph.types';
export declare class SectionExtractionStage {
    extract(doc: CleanedDocument, tree: DocumentTree): SectionNode[];
    private flatten;
    private findActiveNode;
}
