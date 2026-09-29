export type DocumentEngineStatus = 'queued' | 'extracting' | 'understanding' | 'building_knowledge' | 'knowledge_ready' | 'completed' | 'needs_review' | 'rejected' | 'failed';
export type SourceDocumentType = 'bare_act' | 'case_compilation' | 'notes' | 'textbook' | 'unknown';
export interface NormalizedBlock {
    index: number;
    text: string;
    page?: number;
    slide?: number;
    styleHints: {
        bold?: boolean;
        fontSize?: number;
        indentLevel?: number;
        isListItem?: boolean;
        nativeHeadingLevel?: number;
    };
    needsOCR: boolean;
}
export interface NormalizedDocument {
    blocks: NormalizedBlock[];
    sourceFormat: 'pdf' | 'docx' | 'pptx' | 'image' | 'text';
}
export interface OCRBlock {
    index: number;
    text: string;
    confidence: number;
    region: 'body' | 'footnote' | 'header_footer' | 'table' | 'marginalia';
    page?: number;
}
export interface CleaningLogEntry {
    blockIndex: number;
    removed: string[];
}
export interface CleanedDocument {
    blocks: NormalizedBlock[];
    cleaningLog: CleaningLogEntry[];
}
export interface DocumentTreeNode {
    id: string;
    level: number;
    title: string;
    startOffset: number;
    endOffset: number;
    confidence: number;
    children: DocumentTreeNode[];
}
export interface DocumentTree {
    documentType: SourceDocumentType;
    documentTypeConfidence: number;
    root: DocumentTreeNode[];
}
export type SectionType = 'statutory_provision' | 'case_paragraph' | 'notes_block' | 'preamble' | 'schedule' | 'unclassified';
export interface SectionNode {
    id: string;
    treeNodeId: string | null;
    hierarchyPath: string;
    sectionType: SectionType;
    text: string;
    confidence: number;
    needsReview: boolean;
}
export interface TopicTag {
    topic: string;
    confidence: number;
}
export interface SubtopicTag {
    topic: string;
    subtopic: string;
    confidence: number;
}
export type ExamConstructType = 'test' | 'doctrine' | 'exception' | 'principle' | 'holding';
export interface ExamConstruct {
    sectionId: string;
    constructType: ExamConstructType;
    text: string;
}
export type DefinitionType = 'statutory' | 'doctrinal' | 'descriptive';
export interface DefinitionEntry {
    id: string;
    sectionId: string;
    term: string;
    definitionText: string;
    definitionType: DefinitionType;
    scope: 'document_wide' | 'local';
}
export type IllustrationType = 'statutory' | 'instructional_hypothetical';
export interface IllustrationEntry {
    id: string;
    sectionId: string;
    text: string;
    illustrationType: IllustrationType;
    linkedDefinitionId: string | null;
    linkedConstructSectionId: string | null;
}
export interface CaseStructured {
    facts?: string;
    issues?: string;
    held?: string;
    ratio?: string;
}
export interface CaseEntry {
    id: string;
    sectionId: string | null;
    caseName: string;
    parties: {
        petitioner?: string;
        respondent?: string;
    } | null;
    court: string | null;
    year: string | null;
    mentionType: 'full' | 'mention';
    structured: CaseStructured | null;
    context: string;
}
export type CitationType = 'statute' | 'case' | 'cross_reference';
export interface CitationEntry {
    id: string;
    sectionId: string;
    rawText: string;
    citationType: CitationType;
    normalizedForm: string;
    resolvedTargetId: string | null;
}
export interface UnresolvedReference {
    sectionId: string;
    rawText: string;
    reason: string;
}
export interface DocumentGraph {
    tree: DocumentTree;
    sections: SectionNode[];
    topicTags: Record<string, TopicTag[]>;
    subtopicTags: Record<string, SubtopicTag[]>;
    examConstructs: ExamConstruct[];
    definitions: DefinitionEntry[];
    illustrations: IllustrationEntry[];
    cases: CaseEntry[];
    citations: CitationEntry[];
    unresolvedReferences: UnresolvedReference[];
}
export interface RetrievableUnit {
    id: string;
    type: 'section' | 'definition' | 'case' | 'illustration';
    hierarchyPath: string;
    text: string;
    refId: string;
}
export interface KnowledgeBaseRecord {
    documentId: string;
    documentType: SourceDocumentType;
    language: string;
    dominantTopics: string[];
    graph: DocumentGraph;
    retrievableUnits: RetrievableUnit[];
    confidenceScore: number;
    needsReview: boolean;
    reviewReasons: string[];
}
export interface GateResult {
    passed: boolean;
    reason?: string;
    metadata?: Record<string, any>;
}
