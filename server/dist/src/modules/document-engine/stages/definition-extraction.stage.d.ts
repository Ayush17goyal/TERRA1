import { DefinitionEntry, SectionNode, SourceDocumentType } from '../types/document-graph.types';
export declare class DefinitionExtractionStage {
    extract(section: SectionNode, documentType: SourceDocumentType): DefinitionEntry[];
}
