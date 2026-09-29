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

export type RetrievedAuthority = {
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
};

export type ExtractedCitation = {
  id: string;
  citation: string;
  type: 'section' | 'article' | 'case' | 'source_document';
  sourceId?: string;
  support: 'retrieved' | 'generated';
  excerpt?: string;
};

export type BuiltLegalContext = {
  contextBlock: string;
  authorities: RetrievedAuthority[];
  hasAuthoritativeSources: boolean;
};

export type AuthorityVerification = {
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
};

export type LegalReasoningResult = {
  content: string;
  provider: string;
  model: string;
};
