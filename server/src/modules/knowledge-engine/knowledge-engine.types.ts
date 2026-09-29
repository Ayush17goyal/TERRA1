import { CaseStructured, DefinitionType, IllustrationType } from '../document-engine/types/document-graph.types';

export type LibraryStatus = 'building' | 'ready' | 'needs_review' | 'failed';

export type KnowledgeLibraryStage =
  | 'extracting_topics'
  | 'building_topic_graph'
  | 'calculating_coverage'
  | 'knowledge_library_ready';

export interface SourceReference {
  documentId: string;
  sectionId?: string | null;
  entityId?: string | null;
  sourceType: 'document' | 'userCorrection';
  hierarchyPath?: string;
  text?: string;
}

export interface DefinitionRecord {
  id: string;
  term: string;
  definitionText: string;
  definitionType: DefinitionType;
  sourceRefs: SourceReference[];
}

export interface ProvisionRecord {
  id: string;
  text: string;
  normalizedKey: string;
  sourceRefs: SourceReference[];
}

export interface PrincipleRecord {
  id: string;
  text: string;
  constructType: 'principle' | 'doctrine' | 'test' | 'holding';
  sourceRefs: SourceReference[];
}

export interface ExceptionRecord {
  id: string;
  text: string;
  qualifiesPrincipleId: string | null;
  sourceRefs: SourceReference[];
}

export interface CaseRecord {
  id: string;
  caseName: string;
  court: string | null;
  year: string | null;
  structured: CaseStructured | null;
  isLandmark: boolean;
  isReferenced: boolean;
  sourceRefs: SourceReference[];
}

export interface ExampleRecord {
  id: string;
  text: string;
  exampleType: IllustrationType | 'section_example';
  illustratesEntityId: string | null;
  sourceRefs: SourceReference[];
}

export interface ComparisonRecord {
  id: string;
  leftEntityId: string;
  rightEntityId: string;
  axis: string;
  sourceRefs: SourceReference[];
}

export interface TopicKeyword {
  value: string;
  weight: number;
}
