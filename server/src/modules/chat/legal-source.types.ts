export type LegalSourceType =
  | 'qdrant'
  | 'supreme_court'
  | 'india_code'
  | 'law_commission'
  | 'government_repository'
  | 'general_legal_search';

export type LegalSourceTier = 1 | 2 | 3 | 4 | 5 | 6;

export type LegalSource = {
  id: string;
  title: string;
  normalizedCitation: string | null;
  sourceType: LegalSourceType;
  tier: LegalSourceTier;
  authorityScore: number;
  confidenceScore: number;
  relevanceScore: number;
  jurisdiction: 'India';
  url?: string;
  excerpt: string;
  date?: string;
  court?: string;
  actName?: string;
  section?: string;
  reportNumber?: string;
  metadata: Record<string, any>;
};

export const AUTHORITY_SCORES: Record<LegalSourceType, number> = {
  qdrant: 0.9,
  supreme_court: 1,
  india_code: 0.97,
  law_commission: 0.88,
  government_repository: 0.82,
  general_legal_search: 0.55,
};
