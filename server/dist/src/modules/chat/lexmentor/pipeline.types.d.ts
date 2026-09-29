export type LegalIntent = 'Concept' | 'Bare Act' | 'Case Law' | 'Constitutional Law' | 'Research' | 'Drafting' | 'Contract' | 'Moot Court' | 'General';
export type AuthorityCollection = 'Constitution' | 'Bare Acts' | 'Supreme Court Judgments' | 'High Court Judgments' | 'Law Commission Reports' | 'Research Papers' | 'User Uploaded Documents';
export type AnswerDepth = 'Beginner' | 'Intermediate' | 'Expert';
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
    retrievalScore: number;
    rerankerScore: number;
    authorityStrength: number;
    metadata: Record<string, any>;
}
export interface ExtractedCitation {
    id: string;
    citation: string;
    type: 'section' | 'article' | 'case' | 'source_document';
    sourceId?: string;
    support: 'retrieved' | 'generated';
    excerpt?: string;
    verified: boolean;
}
export interface BuiltLegalContext {
    contextBlock: string;
    authorities: RetrievedAuthority[];
    hasAuthoritativeSources: boolean;
    tokenEstimate: number;
}
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
export interface LegalReasoningResult {
    content: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
}
export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
}
export interface ExpandedQueries {
    original: string;
    hydeVector?: number[];
    subQueries: string[];
    rewrittenQuery: string;
}
export interface PipelineContext {
    requestId: string;
    userId?: string;
    sessionId: string;
    rawQuery: string;
    depth: AnswerDepth;
    history: ConversationMessage[];
    intent: LegalIntent;
    intentConfidence: number;
    retrievalConfidence: number;
    fromUploadedDocument: boolean;
    skippedReasoning: boolean;
    legalEvidenceValidation: LegalEvidenceValidation | null;
    expanded: ExpandedQueries;
    rawAuthorities: RetrievedAuthority[];
    rankedAuthorities: RetrievedAuthority[];
    legalContext: BuiltLegalContext;
    reasoning: LegalReasoningResult;
    citations: ExtractedCitation[];
    verification: AuthorityVerification;
    formattedContent: string;
    references?: Array<{
        id: string;
        content: string;
    }>;
    startedAt: number;
    stageTimings: Partial<Record<PipelineStage, number>>;
}
export type PipelineStage = 'conversation_memory' | 'intent_detection' | 'query_validation' | 'query_rewriter' | 'hybrid_retrieval' | 'reranking' | 'context_build' | 'legal_reasoning' | 'citation_verification' | 'response_format' | 'stream_delivery' | 'store_conversation' | 'analytics';
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
export interface LegacyCitation {
    id: string;
    source: string;
    collection: string;
    score: number;
    excerpt: string;
    metadata: Record<string, any>;
}
