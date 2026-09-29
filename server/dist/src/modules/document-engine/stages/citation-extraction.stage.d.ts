import { CaseEntry, CitationEntry, SectionNode } from '../types/document-graph.types';
export declare class CitationExtractionStage {
    extract(section: SectionNode, casesInDocument: CaseEntry[]): CitationEntry[];
    private normalizeCaseCitation;
    private resolveToNearbyCase;
}
