import { Injectable } from '@nestjs/common';
import { BuiltLegalContext, LegalIntent, RetrievedAuthority } from './pipeline.types';
import {
  LEGAL_ANSWER_VALIDATION_CONFIG,
  LEGAL_VERIFICATION_FAILURE_MESSAGE,
} from './legal-answer-generation.config';

export type LegalEvidenceConfidence = 'high' | 'medium' | 'low';

export interface LegalEvidenceValidationResult {
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

@Injectable()
export class LegalEvidenceValidator {
  validate(input: {
    query: string;
    intent: LegalIntent;
    context: BuiltLegalContext;
    retrievalConfidence: number;
  }): LegalEvidenceValidationResult {
    const authorities = input.context.authorities;
    const bestSimilarity = Math.max(0, ...authorities.map((authority) => authority.retrievalScore ?? 0));
    const hasRelevantLegalEvidence = authorities.length > 0 && input.context.hasAuthoritativeSources;
    const sourceAuthoritative = authorities.some((authority) => authority.authorityStrength >= 0.55);
    const sectionOrArticleExists = this.sectionOrArticleExists(input.query, authorities);
    const retrievedTextMatchesQuestion = this.retrievedTextMatchesQuestion(input.query, authorities, bestSimilarity);
    const hasConflictingSources = this.hasConflictingSources(authorities);

    const score = this.confidenceScore({
      retrievalConfidence: input.retrievalConfidence,
      bestSimilarity,
      hasRelevantLegalEvidence,
      sectionOrArticleExists,
      retrievedTextMatchesQuestion,
      sourceAuthoritative,
      hasConflictingSources,
    });

    const confidence: LegalEvidenceConfidence =
      score >= LEGAL_ANSWER_VALIDATION_CONFIG.minConfidenceForDefinitiveAnswer
        ? 'high'
        : score >= LEGAL_ANSWER_VALIDATION_CONFIG.mediumConfidenceFloor
          ? 'medium'
          : 'low';

    const canGenerateDefinitiveAnswer =
      confidence !== 'low' &&
      hasRelevantLegalEvidence &&
      sectionOrArticleExists &&
      retrievedTextMatchesQuestion &&
      sourceAuthoritative &&
      !hasConflictingSources &&
      bestSimilarity >= LEGAL_ANSWER_VALIDATION_CONFIG.minSimilarityScore;

    return {
      confidence,
      confidenceScore: score,
      canGenerateDefinitiveAnswer,
      hasRelevantLegalEvidence,
      sectionOrArticleExists,
      retrievedTextMatchesQuestion,
      sourceAuthoritative,
      hasConflictingSources,
      reason: this.reason({
        hasRelevantLegalEvidence,
        sectionOrArticleExists,
        retrievedTextMatchesQuestion,
        sourceAuthoritative,
        hasConflictingSources,
        bestSimilarity,
      }),
      userMessage: canGenerateDefinitiveAnswer ? undefined : this.failureMessage(hasConflictingSources),
    };
  }

  private sectionOrArticleExists(query: string, authorities: RetrievedAuthority[]): boolean {
    const references = this.extractRequestedReferences(query);
    if (!references.length) return true;

    return references.every((reference) =>
      authorities.some((authority) => this.authorityContainsReference(authority, reference)),
    );
  }

  private retrievedTextMatchesQuestion(
    query: string,
    authorities: RetrievedAuthority[],
    bestSimilarity: number,
  ): boolean {
    if (!authorities.length) return false;
    if (bestSimilarity >= LEGAL_ANSWER_VALIDATION_CONFIG.minSimilarityScore) return true;

    const queryTerms = this.significantTerms(query);
    if (!queryTerms.length) return bestSimilarity >= LEGAL_ANSWER_VALIDATION_CONFIG.mediumConfidenceFloor;

    const evidenceText = authorities
      .slice(0, 5)
      .map((authority) => `${authority.title} ${authority.citation ?? ''} ${authority.chunkText}`)
      .join(' ')
      .toLowerCase();

    const matched = queryTerms.filter((term) => evidenceText.includes(term)).length;
    return matched / queryTerms.length >= 0.6;
  }

  private hasConflictingSources(authorities: RetrievedAuthority[]): boolean {
    const text = authorities.map((authority) => `${authority.title} ${authority.chunkText}`).join('\n').toLowerCase();
    return [
      'contrary view',
      'conflicting',
      'conflict between',
      'overruled',
      'repealed',
      'struck down',
      'no longer good law',
      'per incuriam',
      'referred to larger bench',
    ].some((signal) => text.includes(signal));
  }

  private confidenceScore(input: {
    retrievalConfidence: number;
    bestSimilarity: number;
    hasRelevantLegalEvidence: boolean;
    sectionOrArticleExists: boolean;
    retrievedTextMatchesQuestion: boolean;
    sourceAuthoritative: boolean;
    hasConflictingSources: boolean;
  }): number {
    let score =
      input.retrievalConfidence * 0.35 +
      input.bestSimilarity * 0.25 +
      (input.hasRelevantLegalEvidence ? 0.15 : 0) +
      (input.sectionOrArticleExists ? 0.1 : 0) +
      (input.retrievedTextMatchesQuestion ? 0.1 : 0) +
      (input.sourceAuthoritative ? 0.05 : 0);

    if (input.hasConflictingSources) score -= 0.3;
    return Math.max(0, Math.min(1, Number(score.toFixed(2))));
  }

  private reason(input: {
    hasRelevantLegalEvidence: boolean;
    sectionOrArticleExists: boolean;
    retrievedTextMatchesQuestion: boolean;
    sourceAuthoritative: boolean;
    hasConflictingSources: boolean;
    bestSimilarity: number;
  }): string {
    if (!input.hasRelevantLegalEvidence) return 'No legal documents were retrieved.';
    if (input.bestSimilarity < LEGAL_ANSWER_VALIDATION_CONFIG.minSimilarityScore) return 'Top retrieval similarity is below the legal reliability threshold.';
    if (!input.sectionOrArticleExists) return 'Requested Section or Article was not verified in the retrieved legal text.';
    if (!input.retrievedTextMatchesQuestion) return 'Retrieved text does not sufficiently match the legal question.';
    if (!input.sourceAuthoritative) return 'Retrieved material is not authoritative enough for a definitive legal answer.';
    if (input.hasConflictingSources) return 'Conflicting or adverse legal-source signals were found in retrieved material.';
    return 'Retrieved legal evidence supports a grounded answer.';
  }

  private failureMessage(hasConflictingSources: boolean): string {
    if (hasConflictingSources) {
      return `${LEGAL_VERIFICATION_FAILURE_MESSAGE} The retrieved sources contain conflict or adverse-status signals, so I cannot give a definitive answer without clarification or further authoritative material.`;
    }

    return LEGAL_VERIFICATION_FAILURE_MESSAGE;
  }

  private extractRequestedReferences(query: string): Array<{ type: 'section' | 'article'; number: string }> {
    const references: Array<{ type: 'section' | 'article'; number: string }> = [];
    const pattern = /\b(section|sec\.?|article|art\.?)\s+(\d+[a-z]?(?:\s*\([^)]+\))?)/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(query)) !== null) {
      const rawType = match[1].toLowerCase();
      references.push({
        type: rawType.startsWith('art') ? 'article' : 'section',
        number: this.normalizeReferenceNumber(match[2]),
      });
    }

    return references;
  }

  private authorityContainsReference(
    authority: RetrievedAuthority,
    reference: { type: 'section' | 'article'; number: string },
  ): boolean {
    const metadataValue = reference.type === 'article' ? authority.article : authority.section;
    if (metadataValue && this.normalizeReferenceNumber(metadataValue) === reference.number) return true;

    const label = reference.type === 'article' ? 'article' : 'section';
    const escapedNumber = reference.number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\s\*/g, '\\s*');
    const referencePattern = new RegExp(`\\b${label}\\s+${escapedNumber}\\b`, 'i');
    return referencePattern.test(`${authority.title} ${authority.citation ?? ''} ${authority.chunkText}`);
  }

  private normalizeReferenceNumber(value: string): string {
    return value.toLowerCase().replace(/\s+/g, '').trim();
  }

  private significantTerms(query: string): string[] {
    const stopWords = new Set([
      'what',
      'which',
      'where',
      'when',
      'why',
      'how',
      'the',
      'and',
      'or',
      'for',
      'from',
      'about',
      'explain',
      'section',
      'article',
      'act',
      'law',
      'legal',
      'does',
      'mean',
    ]);

    return Array.from(
      new Set(
        query
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((term) => term.length >= 4 && !stopWords.has(term) && !/^\d+$/.test(term)),
      ),
    ).slice(0, 12);
  }
}
