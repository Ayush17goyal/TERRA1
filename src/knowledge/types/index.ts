import type { PromptIntent, StudentLevel, TeachingStrategy } from '../../ai/prompts/types';

export type KnowledgeKind =
  | 'curriculum'
  | 'lesson'
  | 'student_state'
  | 'mastery'
  | 'weakness'
  | 'draft_history'
  | 'revision_history'
  | 'previous_feedback'
  | 'pattern'
  | 'bare_act_component'
  | 'assessment_rule'
  | 'capstone_project'
  | 'prompt_module'
  | 'teaching_rule'
  | 'behaviour_rule';

export type RetrievalMode = 'vector' | 'keyword' | 'hybrid';

export interface KnowledgeMetadata {
  userId?: string;
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  projectId?: string;
  draftId?: string;
  patternName?: string;
  componentType?: string;
  difficulty?: StudentLevel | string;
  jurisdiction?: string;
  tags?: string[];
  updatedAt?: string;
  createdAt?: string;
  sourceId?: string;
  version?: string;
  [key: string]: unknown;
}

export interface KnowledgeDocument {
  id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  metadata: KnowledgeMetadata;
  embedding?: number[];
}

export interface KnowledgeChunk extends KnowledgeDocument {
  parentId: string;
  chunkIndex: number;
  tokenEstimate: number;
}

export interface RetrievalQuery {
  text: string;
  intent: PromptIntent;
  teachingStrategy: TeachingStrategy;
  studentLevel: StudentLevel;
  kinds: KnowledgeKind[];
  mode: RetrievalMode;
  filters: KnowledgeMetadata;
  limit: number;
  tokenBudget: number;
  recencyBoost?: boolean;
  requiredIds?: string[];
}

export interface RetrievalCandidate {
  document: KnowledgeDocument;
  vectorScore?: number;
  keywordScore?: number;
  metadataScore?: number;
  recencyScore?: number;
  masteryScore?: number;
  finalScore: number;
  reasons: string[];
}

export interface KnowledgeContextItem {
  id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  metadata: KnowledgeMetadata;
  score: number;
  reasons: string[];
  tokenEstimate: number;
}

export interface KnowledgeRetrievalResult {
  intent: PromptIntent;
  teachingStrategy: TeachingStrategy;
  query: string;
  items: KnowledgeContextItem[];
  omitted: KnowledgeContextItem[];
  tokenBudget: number;
  usedTokens: number;
  warnings: string[];
}

export interface KnowledgeRetrievalRequest {
  userId?: string;
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  projectId?: string;
  draftId?: string;
  userMessage: string;
  normalizedMessage?: string;
  intent: PromptIntent;
  teachingStrategy: TeachingStrategy;
  studentLevel: StudentLevel;
  currentLessonTitle?: string;
  currentModuleTitle?: string;
  patternNames?: string[];
  componentTypes?: string[];
  jurisdiction?: string;
  difficulty?: string;
  masteryState?: string;
  tokenBudget?: number;
  includeKinds?: KnowledgeKind[];
}

export interface RetrieverPlan {
  retrieverName: string;
  query: RetrievalQuery;
}

export interface RetrievalCacheEntry {
  key: string;
  value: KnowledgeRetrievalResult;
  expiresAt: number;
}

export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  getVectorSize(): number;
}

export interface KnowledgeRepository {
  searchVector(query: RetrievalQuery, embedding: number[]): Promise<RetrievalCandidate[]>;
  searchKeyword(query: RetrievalQuery): Promise<RetrievalCandidate[]>;
  getByIds(ids: string[]): Promise<KnowledgeDocument[]>;
  upsertChunks(chunks: KnowledgeChunk[]): Promise<void>;
}
