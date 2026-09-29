import { CaseEntry, SectionNode, SourceDocumentType } from '../types/document-graph.types';
export declare class CaseExtractionStage {
    extract(section: SectionNode, documentType: SourceDocumentType): CaseEntry[];
    private stripLeadingDiscourseWords;
    private extractStructure;
}
