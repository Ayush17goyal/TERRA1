import { AnswerDepth, LegalIntent } from './pipeline.types';

export type LegalAnswerTaskType = 'simple_legal_query' | 'detailed_explanation' | 'legal_research';

export const LEGAL_ANSWER_LLM_CONFIG = {
  temperature: 0.1,
  topP: 0.2,
  frequencyPenalty: 0,
  presencePenalty: 0,
} as const;

export const LEGAL_ANSWER_MAX_TOKENS: Record<LegalAnswerTaskType, number> = {
  simple_legal_query: 800,
  detailed_explanation: 1500,
  legal_research: 2500,
};

export const LEGAL_ANSWER_VALIDATION_CONFIG = {
  minSimilarityScore: 0.8,
  minConfidenceForDefinitiveAnswer: 0.8,
  mediumConfidenceFloor: 0.55,
} as const;

export const LEGAL_VERIFICATION_FAILURE_MESSAGE =
  'I could not verify this information from the available legal sources.';

export function classifyLegalAnswerTask(intent: LegalIntent, depth: AnswerDepth): LegalAnswerTaskType {
  if (intent === 'Research' || intent === 'Case Law' || intent === 'Moot Court' || depth === 'Expert') {
    return 'legal_research';
  }

  if (depth === 'Intermediate' || intent === 'Constitutional Law' || intent === 'Drafting' || intent === 'Contract') {
    return 'detailed_explanation';
  }

  return 'simple_legal_query';
}
