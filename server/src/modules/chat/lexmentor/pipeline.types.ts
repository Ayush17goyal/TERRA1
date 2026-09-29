/**
 * Pipeline types — the single data contract flowing through all 12 stages.
 * Every stage receives the context object and adds its own fields.
 * Nothing leaves the pipeline that wasn't verified by the stage that produced it.
 */

export type LegalIntent =
  | 'Concept'
  | 'Bare Act'
  | 'Case Law'
  | 'Constitutional Law'
  | 'Research'
  | 'Drafting'
  | 'Contract'
  | 'Moot Court'
  | 'General';

export type AuthorityCollection =
  | 'Constitution'
  | 'Bare Acts'
  | 'Supreme Court Judgments'
  | 'High Court Judgments'
  | 'Law Commission Reports'
  | 'Research Papers'
  | 'User Uploaded Documents';

/** Depth of the answer to generate */
export type AnswerDepth = 'Beginner' | 'Intermediate' | 'Expert';

/** A single retrieved authority chunk from Qdrant */
export interface RetrievedAuthority {
  id: string;
  collection: AuthorityCollection;
  collectionName: string;
  title: string;
  citation?: string;
  court?: string;
  date?: string;
  benchStrength?: number;
  sourceDocument?: string;
  page?: string;
  section?: string;
  article?: string;
  chunkText: string;
  /** Raw Qdrant cosine similarity score */
  retrievalScore: number;
  /** Final score after semantic reranking */
  rerankerScore: number;
  /** Normalized authority weight: 1.0 = Constitution, 0.55 = user doc */
  authorityStrength: number;
  metadata: Record<string, any>;
}

/** A single resolved citation in the generated answer */
export interface ExtractedCitation {
  id: string;
  citation: string;
  type: 'section' | 'article' | 'case' | 'source_document';
  sourceId?: string;
  support: 'retrieved' | 'generated';
  excerpt?: string;
  verified: boolean;
}

/** Assembled prompt context ready for the LLM */
export interface BuiltLegalContext {
  contextBlock: string;
  authorities: RetrievedAuthority[];
  hasAuthoritativeSources: boolean;
  tokenEstimate: number;
}

/** Citation verification result */
export type LegalEvidenceConfidence = 'high' | 'medium' | 'low';

export interface LegalEvidenceValidation {
  confidence: LegalEvidenceConfidence;
  confidenceScore: number;
  canGenerateDefinitiveAnswer: boolean;
  hasRelevantLegalEvidence: boolean;
  sectionOrArticleExists: boolean;
  retrievedTextMatchesQuestion: boolean;
  sourceAuthoritative: boolean;
  hasConflictingSources: boolean;
  reason: string;
  userMessage?: string;
}

export interface AuthorityVerification {
  available: boolean;
  authorityStatus?: string;
  goodLawStatus?: string;
  recentAmendments?: string;
  conflictingJudgments?: string;
  bindingAuthority?: string;
  bindingCourt?: string;
  citationAccuracy?: number;
  confidenceScore?: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
  lastVerified?: string;
  verificationTimestamp?: string;
  details?: {
    reason: string;
    latestAuthority?: string;
    relevantAmendment?: string;
    newJudgment?: string;
    conflictingJudgment?: string;
    suggestedAuthority?: string;
  };
  sources?: Array<{
    name: string;
    type: string;
    authorityLevel: string;
    date?: string;
    status: string;
    isValid: boolean;
  }>;
  primarySources?: string[];
  citationValidation?: Array<{
    citation: string;
    status: string;
    paragraphSupport: string;
  }>;
  unsupportedReasoning?: string[];
  professionalSummary?: string;
  evidence?: Record<string, any>;
}

/** Raw output from the LLM generation stage */
export interface LegalReasoningResult {
  content: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

/** A single message in a conversation turn */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

/** Expanded queries from the query rewriter */
export interface ExpandedQueries {
  /** Original normalized query */
  original: string;
  /** HyDE: embedding of the hypothetical answer document */
  hydeVector?: number[];
  /** Sub-queries decomposed from the original (max 3) */
  subQueries: string[];
  /** Rewritten query optimized for retrieval */
  rewrittenQuery: string;
}

/** The full pipeline execution context — every stage reads and writes to this */
export interface PipelineContext {
  // ── Input ──────────────────────────────────────────────────────────────────
  requestId: string;
  userId?: string;
  sessionId: string;
  rawQuery: string;
  depth: AnswerDepth;

  // ── Stage 1: Conversation Memory ──────────────────────────────────────────
  history: ConversationMessage[];

  // ── Stage 2: Intent Detection ─────────────────────────────────────────────
  intent: LegalIntent;
  intentConfidence: number;

  // ── Stage 2b: Query Validation ────────────────────────────────────────────
  retrievalConfidence: number;
  fromUploadedDocument: boolean;
  skippedReasoning: boolean;
  legalEvidenceValidation: LegalEvidenceValidation | null;

  // ── Stage 3: Query Rewriter ───────────────────────────────────────────────
  expanded: ExpandedQueries;

  // ── Stage 4: Hybrid Retrieval ─────────────────────────────────────────────
  rawAuthorities: RetrievedAuthority[];

  // ── Stage 5: Reranking ────────────────────────────────────────────────────
  rankedAuthorities: RetrievedAuthority[];

  // ── Stage 6: Legal Reasoning ──────────────────────────────────────────────
  legalContext: BuiltLegalContext;
  reasoning: LegalReasoningResult;

  // ── Stage 7: Citation Verification ───────────────────────────────────────
  citations: ExtractedCitation[];
  verification: AuthorityVerification;

  // ── Stage 8: Response Formatter ──────────────────────────────────────────
  formattedContent: string;

  // ── References context ────────────────────────────────────────────────────
  references?: Array<{ id: string; content: string }>;

  // ── Pipeline Telemetry ────────────────────────────────────────────────────
  startedAt: number;
  stageTimings: Partial<Record<PipelineStage, number>>;
}

export type PipelineStage =
  | 'conversation_memory'
  | 'intent_detection'
  | 'query_validation'
  | 'query_rewriter'
  | 'hybrid_retrieval'
  | 'reranking'
  | 'context_build'
  | 'legal_reasoning'
  | 'citation_verification'
  | 'response_format'
  | 'stream_delivery'
  | 'store_conversation'
  | 'analytics';

/** Final result returned to the client */
export interface LexMentorResult {
  content: string;
  provider: string;
  model: string;
  intent: LegalIntent;
  citations: LegacyCitation[];
  supportingCitations: ExtractedCitation[];
  retrievedAuthorities: RetrievedAuthority[];
  verification: AuthorityVerification | null;
  legalEvidenceValidation: LegalEvidenceValidation | null;
  verificationPanelAvailable: boolean;
  pipelineMs: number;
  requestId: string;
}

/** Legacy citation shape kept for frontend backward compatibility */
export interface LegacyCitation {
  id: string;
  source: string;
  collection: string;
  score: number;
  excerpt: string;
  metadata: Record<string, any>;
}
