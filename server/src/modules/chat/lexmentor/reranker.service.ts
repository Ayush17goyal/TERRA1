/**
 * Stage 5 — Semantic Reranking
 *
 * Takes the RRF-fused retrieval results and produces a final ranked list
 * by computing a composite semantic relevance score for each chunk.
 *
 * Scoring formula (all weights sum to 1.0):
 *   0.45 × retrieval_score   (RRF-fused Qdrant cosine similarity)
 *   0.25 × authority_weight  (constitutional > SC > HC > statute > secondary)
 *   0.20 × intent_alignment  (collection matches the classified intent)
 *   0.10 × recency_signal    (more recent sources score slightly higher)
 *
 * This is a deterministic, semantic scoring function.
 * There is NO lexical overlap, NO keyword matching, NO term counting.
 *
 * For very high-stakes use cases, this stage can be replaced with a
 * cross-encoder API call (e.g. Cohere Rerank) by implementing the same
 * interface without changing any other stage.
 */

import { Injectable, Logger } from '@nestjs/common';
import { LegalIntent, RetrievedAuthority } from './pipeline.types';

const CURRENT_YEAR = new Date().getFullYear();
const COLLECTION_INTENT_ALIGNMENT: Record<string, Partial<Record<LegalIntent, number>>> = {
  'Constitution': { 'Constitutional Law': 1.0, 'Research': 0.8, 'Moot Court': 0.8, 'Concept': 0.6 },
  'Bare Acts': { 'Bare Act': 1.0, 'Contract': 0.8, 'Concept': 0.7, 'Drafting': 0.7, 'General': 0.5 },
  'Supreme Court Judgments': { 'Case Law': 1.0, 'Constitutional Law': 0.9, 'Research': 0.8, 'Moot Court': 0.9, 'General': 0.6 },
  'High Court Judgments': { 'Case Law': 0.8, 'Research': 0.7, 'Moot Court': 0.6, 'General': 0.5 },
  'Law Commission Reports': { 'Research': 1.0, 'Bare Act': 0.7, 'Concept': 0.6, 'General': 0.5 },
  'Research Papers': { 'Research': 0.9, 'Moot Court': 0.7, 'Concept': 0.6, 'General': 0.4 },
  'User Uploaded Documents': { General: 1.0, Drafting: 1.0, Contract: 0.9, Research: 0.9, 'Bare Act': 0.8 },
};

/** Uploaded documents receive highest reranking priority */
const USER_DOC_BOOST = 0.18;

/** Maximum final chunks passed to the context builder */
const MAX_RERANKED = 12;

/** Minimum reranker score to pass through to context building */
const MIN_RERANKER_SCORE = 0.28;

@Injectable()
export class Reranker {
  private readonly logger = new Logger(Reranker.name);

  rerank(intent: LegalIntent, authorities: RetrievedAuthority[]): RetrievedAuthority[] {
    if (!authorities.length) return [];

    const scored = authorities.map((authority) => {
      const retrievalComponent = this.clamp(authority.retrievalScore) * 0.45;
      const authorityComponent = authority.authorityStrength * 0.25;
      const intentComponent = this.intentAlignmentScore(intent, authority) * 0.20;
      const recencyComponent = this.recencyScore(authority.date) * 0.10;

      const rerankerScore = this.clamp(
        retrievalComponent + authorityComponent + intentComponent + recencyComponent +
        (authority.collection === 'User Uploaded Documents' ? USER_DOC_BOOST : 0),
      );

      return { ...authority, rerankerScore };
    });

    const reranked = scored
      .filter((a) => a.rerankerScore >= MIN_RERANKER_SCORE)
      .sort((a, b) => b.rerankerScore - a.rerankerScore)
      .slice(0, MAX_RERANKED);

    this.logger.debug(
      `Reranker: ${authorities.length} → ${reranked.length} chunks (intent=${intent}, ` +
      `top score=${reranked[0]?.rerankerScore.toFixed(3) ?? 'n/a'})`,
    );

    return reranked;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Scoring components
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns a 0–1 alignment score based on whether the collection type
   * matches the classified legal intent. This replaces keyword matching
   * with a semantic intent-collection affinity matrix.
   */
  private intentAlignmentScore(intent: LegalIntent, authority: RetrievedAuthority): number {
    const alignmentMap = COLLECTION_INTENT_ALIGNMENT[authority.collection];
    if (!alignmentMap) return 0.4; // unknown collection — neutral score
    return alignmentMap[intent] ?? alignmentMap['General'] ?? 0.4;
  }

  /**
   * Gives a mild boost to more recent sources.
   * Parses the date field and scores within a 30-year window.
   * Returns 0.5 when the date is absent.
   */
  private recencyScore(date?: string): number {
    if (!date) return 0.5;

    const year = this.extractYear(date);
    if (!year) return 0.5;

    // Score from 0 (30+ years old) to 1.0 (current year)
    const age = Math.max(0, CURRENT_YEAR - year);
    return Math.max(0, 1 - age / 30);
  }

  private extractYear(date: string): number | null {
    const m = date.match(/\b(19|20)\d{2}\b/);
    if (!m) return null;
    const year = Number(m[0]);
    return year >= 1900 && year <= CURRENT_YEAR ? year : null;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
