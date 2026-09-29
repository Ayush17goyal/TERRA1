// Shared data shapes for the Document Ingestion Engine pipeline.
// These mirror the stage outputs defined in architecture.md §3 (Document Ingestion Engine)
// exactly: Stage N's "Data produced" column maps 1:1 to a type below.

export type DocumentEngineStatus =
  | 'queued'
  | 'extracting'
  | 'understanding'
  | 'building_knowledge'
  | 'knowledge_ready'
  | 'completed'
  | 'needs_review'
  | 'rejected'
  | 'failed';

export type SourceDocumentType = 'bare_act' | 'case_compilation' | 'notes' | 'textbook' | 'unknown';

// ---- Stage 0: Format Normalization ----
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
    nativeHeadingLevel?: number; // from DOCX/PPTX style tags, when available
  };
  needsOCR: boolean;
}

export interface NormalizedDocument {
  blocks: NormalizedBlock[];
  sourceFormat: 'pdf' | 'docx' | 'pptx' | 'image' | 'text';
}

// ---- Stage 1: OCR & Layout Recovery ----
export interface OCRBlock {
  index: number;
  text: string;
  confidence: number; // 0-1
  region: 'body' | 'footnote' | 'header_footer' | 'table' | 'marginalia';
  page?: number;
}

// ---- Stage 2: Text Cleaning ----
export interface CleaningLogEntry {
  blockIndex: number;
  removed: string[]; // description of what was stripped, e.g. "repeated header", "page-number footer"
}

export interface CleanedDocument {
  blocks: NormalizedBlock[];
  cleaningLog: CleaningLogEntry[];
}

// ---- Stage 3: Structural Skeleton ----
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

// ---- Stage 4: Section Extraction ----
export type SectionType =
  | 'statutory_provision'
  | 'case_paragraph'
  | 'notes_block'
  | 'preamble'
  | 'schedule'
  | 'unclassified';

export interface SectionNode {
  id: string;
  treeNodeId: string | null; // null when routed to the review bucket (orphaned/low-confidence text)
  hierarchyPath: string; // e.g. "Constitution > Part III > Article 19 > Clause 1"
  sectionType: SectionType;
  text: string;
  confidence: number;
  needsReview: boolean;
}

// ---- Stage 5-6: Topic / Subtopic Detection ----
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

// ---- Stage 7: Definitions ----
export type DefinitionType = 'statutory' | 'doctrinal' | 'descriptive';

export interface DefinitionEntry {
  id: string;
  sectionId: string;
  term: string;
  definitionText: string;
  definitionType: DefinitionType;
  scope: 'document_wide' | 'local';
}

// ---- Stage 8: Illustrations ----
export type IllustrationType = 'statutory' | 'instructional_hypothetical';

export interface IllustrationEntry {
  id: string;
  sectionId: string;
  text: string;
  illustrationType: IllustrationType;
  linkedDefinitionId: string | null;
  linkedConstructSectionId: string | null;
}

// ---- Stage 9: Cases ----
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
  parties: { petitioner?: string; respondent?: string } | null;
  court: string | null;
  year: string | null;
  mentionType: 'full' | 'mention';
  structured: CaseStructured | null;
  context: string; // surrounding text, for 'mention' entries
}

// ---- Stage 10: Citations ----
export type CitationType = 'statute' | 'case' | 'cross_reference';

export interface CitationEntry {
  id: string;
  sectionId: string;
  rawText: string;
  citationType: CitationType;
  normalizedForm: string;
  resolvedTargetId: string | null; // resolves to a CaseEntry/DefinitionEntry id found in this same document
}

// ---- Stage 11: Cross-Linking ----
export interface UnresolvedReference {
  sectionId: string;
  rawText: string;
  reason: string;
}

export interface DocumentGraph {
  tree: DocumentTree;
  sections: SectionNode[];
  topicTags: Record<string, TopicTag[]>; // sectionId -> tags
  subtopicTags: Record<string, SubtopicTag[]>;
  examConstructs: ExamConstruct[];
  definitions: DefinitionEntry[];
  illustrations: IllustrationEntry[];
  cases: CaseEntry[];
  citations: CitationEntry[];
  unresolvedReferences: UnresolvedReference[];
}

// ---- Stage 12: Metadata & Knowledge Base Assembly ----
export interface RetrievableUnit {
  id: string;
  type: 'section' | 'definition' | 'case' | 'illustration';
  hierarchyPath: string;
  text: string;
  refId: string; // id of the underlying SectionNode/DefinitionEntry/CaseEntry/IllustrationEntry
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

// ---- Gate results (architecture.md §3.3) ----
export interface GateResult {
  passed: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}



