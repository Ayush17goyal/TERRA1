/**
 * LexMentor AI — response policy constants and retrieval confidence helpers.
 * Single source of truth for legal-only mode, zero-hallucination messages,
 * and confidence thresholds used across the pipeline.
 */

import { LegalEvidenceValidation, RetrievedAuthority } from './pipeline.types';
import { LEGAL_ANSWER_VALIDATION_CONFIG, LEGAL_VERIFICATION_FAILURE_MESSAGE } from './legal-answer-generation.config';

export const LEXMENTOR_LEGAL_ONLY_REJECTION =
  'LexMentor AI is designed exclusively for legal education and legal research. Please ask a question related to law.';

export const LEXMENTOR_LOW_CONFIDENCE_RESPONSE =
  'I am not sufficiently confident to provide a reliable legal answer based on the available legal sources.';

export const LEXMENTOR_CANNOT_VERIFY_RESPONSE =
  LEGAL_VERIFICATION_FAILURE_MESSAGE + ' Please upload the relevant document or refine your question.';

export const LEXMENTOR_NO_AUTHORITATIVE_MATERIAL =
  'I could not locate authoritative legal material supporting this question.';

export const LEXMENTOR_LEGAL_DISCLAIMER =
  'This response is for legal education and research purposes only and should not be treated as professional legal advice.';

export const LEXMENTOR_UPLOADED_DOC_NOTE =
  'Answer generated from your uploaded document.';

/** Minimum retrieval confidence (0–1) required before generating a legal answer */
export const RETRIEVAL_CONFIDENCE_THRESHOLD = LEGAL_ANSWER_VALIDATION_CONFIG.minConfidenceForDefinitiveAnswer;

export function computeRetrievalConfidence(authorities: RetrievedAuthority[]): number {
  if (!authorities.length) return 0;

  const topScore = authorities[0]?.rerankerScore ?? 0;
  const avgRerank =
    authorities.reduce((sum, a) => sum + a.rerankerScore, 0) / authorities.length;
  const avgAuthority =
    authorities.reduce((sum, a) => sum + a.authorityStrength, 0) / authorities.length;
  const countFactor = Math.min(1, authorities.length / 4);
  const hasUserDoc = authorities.some((a) => a.collection === 'User Uploaded Documents');
  const userDocBoost = hasUserDoc ? 0.05 : 0;

  return clamp(
    topScore * 0.38 +
      avgRerank * 0.28 +
      avgAuthority * 0.2 +
      countFactor * 0.09 +
      userDocBoost +
      0.05,
  );
}

export function hasUploadedDocumentSources(authorities: RetrievedAuthority[]): boolean {
  return authorities.some((a) => a.collection === 'User Uploaded Documents');
}

export function buildMissingMaterialGuidance(): string {
  return [
    'You may:',
    '• Upload a relevant legal document',
    '• Specify the Act name',
    '• Specify the Section or Article number',
    '• Specify the Case Name',
  ].join('\n');
}

export function buildInsufficientConfidenceResponse(includeGuidance = true): string {
  const sections = [
    '## Answer',
    LEXMENTOR_LOW_CONFIDENCE_RESPONSE,
    '',
    '## Important Notes',
    LEXMENTOR_CANNOT_VERIFY_RESPONSE,
  ];
  if (includeGuidance) {
    sections.push('', buildMissingMaterialGuidance());
  }
  sections.push(
    '',
    '## Confidence Level',
    'Low — retrieval confidence below the reliability threshold (80%).',
    '',
    '---',
    LEXMENTOR_LEGAL_DISCLAIMER,
  );
  return sections.join('\n');
}

export function buildNoRetrievalResponse(includeGuidance = true): string {
  const sections = [
    '## Answer',
    LEXMENTOR_NO_AUTHORITATIVE_MATERIAL,
    '',
    '## Important Notes',
    LEXMENTOR_CANNOT_VERIFY_RESPONSE,
  ];
  if (includeGuidance) {
    sections.push('', buildMissingMaterialGuidance());
  }
  sections.push(
    '',
    '## Confidence Level',
    'Low — no authoritative legal material was retrieved.',
    '',
    '---',
    LEXMENTOR_LEGAL_DISCLAIMER,
  );
  return sections.join('\n');
}


export function buildLegalEvidenceFailureResponse(validation: LegalEvidenceValidation, includeGuidance = true): string {
  const sections = [
    '## Answer',
    validation.userMessage || LEGAL_VERIFICATION_FAILURE_MESSAGE,
    '',
    '## Legal Evidence Validation',
    `Confidence: ${validation.confidence} (${Math.round(validation.confidenceScore * 100)}%).`,
    `Reason: ${validation.reason}`,
    `Relevant legal evidence retrieved: ${validation.hasRelevantLegalEvidence ? 'Yes' : 'No'}.`,
    `Section/Article verified: ${validation.sectionOrArticleExists ? 'Yes' : 'No'}.`,
    `Retrieved text matches question: ${validation.retrievedTextMatchesQuestion ? 'Yes' : 'No'}.`,
    `Authoritative source: ${validation.sourceAuthoritative ? 'Yes' : 'No'}.`,
    `Conflicting sources: ${validation.hasConflictingSources ? 'Yes' : 'No'}.`,
  ];

  if (includeGuidance) {
    sections.push('', buildMissingMaterialGuidance());
  }

  sections.push('', '---', LEXMENTOR_LEGAL_DISCLAIMER);
  return sections.join('\n');
}
export function formatConfidenceLevel(score: number): string {
  const pct = Math.round(score * 100);
  if (score >= RETRIEVAL_CONFIDENCE_THRESHOLD) {
    return `High — ${pct}% retrieval confidence (meets the 80% reliability threshold).`;
  }
  if (score >= 0.55) {
    return `Medium — ${pct}% retrieval confidence (below the 80% reliability threshold).`;
  }
  return `Low — ${pct}% retrieval confidence.`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
