export type LegalNodeType = 'act' | 'part' | 'title' | 'chapter' | 'article' | 'section' | 'subsection' | 'clause' | 'subclause' | 'proviso' | 'explanation' | 'illustration' | 'exception' | 'schedule' | 'footnote' | 'amendment_note' | 'definition' | 'table' | 'body';
export interface LegalNode {
    type: LegalNodeType;
    number?: string;
    title?: string;
    content?: string;
    children?: LegalNode[];
}
export interface ProvisionMetadata {
    part?: string;
    titleLevel?: string;
    chapter?: string;
    article?: string;
    section?: string;
    subsection?: string;
    clause?: string;
    provisionType?: 'article' | 'section';
    title?: string;
    content: string;
}
export interface ParserValidationResult {
    totalParts: number;
    totalTitles: number;
    totalChapters: number;
    totalArticles: number;
    totalSections: number;
    totalSchedules: number;
    totalExplanations: number;
    totalIllustrations: number;
    totalScheduleItems: number;
    duplicateProvisions: string[];
    orphanClauses: number;
    orphanExplanations: number;
    brokenHierarchy: string[];
}
export interface LegalDocumentMeta {
    actName: string;
    category: string;
    year?: number;
    officialName?: string;
    totalParts: number;
    totalTitles: number;
    totalChapters: number;
    totalArticles: number;
    totalSections: number;
    totalSchedules: number;
    totalExplanations: number;
    totalIllustrations: number;
    duplicates: number;
    orphanClauses: number;
    orphanExplanations: number;
    brokenHierarchy: number;
}
export interface LegalDocumentResult {
    meta: LegalDocumentMeta;
    structure: LegalNode[];
    validation: ParserValidationResult;
}
export declare function parseLegalStructure(lines: string[]): LegalNode[];
export declare function flattenProvisions(nodes: LegalNode[], context?: ProvisionMetadata): ProvisionMetadata[];
export declare function validateLegalStructure(nodes: LegalNode[]): ParserValidationResult;
export declare function parseLegalDocument(lines: string[], actName: string, category: string, officialName?: string): LegalDocumentResult;
