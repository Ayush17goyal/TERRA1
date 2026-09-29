/**
 * Stage 7b — Authority Verification Engine
 *
 * Produces a structured AuthorityVerification object from the retrieved
 * authorities and extracted citations.
 *
 * This is a corpus-grounded analysis:
 *   - Confidence is derived from retrieval scores, authority weights, and
 *     citation coverage — not from hardcoded heuristics.
 *   - Hallucination risk is computed by comparing citations in the generated
 *     answer against citations present in the retrieved material.
 *   - Amendment and conflict signals are detected in the retrieved text,
 *     not by keyword-matching the generated answer.
 *
 * If no authoritative material was retrieved (retrieval returned 0 chunks),
 * the verification object is returned with available=false. The pipeline
 * never pretends to verify what it has not retrieved.
 */

import { Injectable } from '@nestjs/common';
import {
  AuthorityVerification,
  ExtractedCitation,
  RetrievedAuthority,
} from './pipeline.types';

@Injectable()
export class AuthorityVerificationEngine {
  verify(
    authorities: RetrievedAuthority[],
    citations: ExtractedCitation[],
    answer = '',
  ): AuthorityVerification {
    if (!authorities.length) {
      return {
        available: false,
        professionalSummary: 'No authoritative sources were retrieved for this query. Verification is not possible.',
      };
    }

    const top = authorities[0];
    const authoritative = authorities.filter((a) => a.authorityStrength >= 0.78);

    // ── Citation coverage ─────────────────────────────────────────────────
    const retrievedKeys = new Set(
      citations
        .filter((c) => c.support === 'retrieved')
        .map((c) => c.citation.toLowerCase()),
    );
    const generated = citations.filter((c) => c.support === 'generated');
    const supportedGenerated = generated.filter((c) =>
      retrievedKeys.has(c.citation.toLowerCase()),
    ).length;
    const citationAccuracy =
      generated.length > 0
        ? Math.round((supportedGenerated / generated.length) * 100)
        : Math.round(
            Math.min(
              100,
              (citations.filter((c) => c.support === 'retrieved').length /
                Math.max(1, authorities.length)) *
                100,
            ),
          );

    // ── Hallucination detection ────────────────────────────────────────────
    const answerCitations = this.extractCitationStrings(answer);
    const unsupported = answerCitations.filter(
      (c) => !retrievedKeys.has(c.toLowerCase()),
    );

    // ── Evidence corpus text ───────────────────────────────────────────────
    const corpusText = authorities
      .map((a) => `${a.title} ${a.citation ?? ''} ${a.chunkText}`)
      .join('\n')
      .toLowerCase();

    const amendmentHits = this.findSignals(corpusText, [
      'amendment',
      'amended',
      'substituted',
      'repealed',
      'omitted',
      'with effect from',
      'inserted by',
    ]);
    const conflictHits = this.findSignals(corpusText, [
      'contrary view',
      'distinguished',
      'overruled',
      'doubted',
      'referred to larger bench',
      'per incuriam',
    ]);
    const invalidHits = this.findSignals(corpusText, [
      'overruled',
      'repealed',
      'struck down',
      'unconstitutional',
      'no longer good law',
    ]);

    // ── Confidence formula ─────────────────────────────────────────────────
    const avgRetrieval = this.avg(authorities.map((a) => a.retrievalScore));
    const avgRerank = this.avg(authorities.map((a) => a.rerankerScore));
    const avgAuthority = this.avg(authorities.map((a) => a.authorityStrength));
    const citationCoverage =
      citations.length
        ? citations.filter((c) => c.support === 'retrieved').length / citations.length
        : 0.45;
    const hallucinationPenalty = Math.min(0.22, unsupported.length * 0.055);

    const confidenceScore = Math.round(
      this.clamp(
        avgRetrieval * 0.28 +
          citationCoverage * 0.22 +
          avgAuthority * 0.22 +
          avgRerank * 0.20 +
          (1 - hallucinationPenalty) * 0.08,
      ) * 100,
    );

    const riskLevel: 'Low' | 'Medium' | 'High' =
      confidenceScore >= 78 && !invalidHits.length && unsupported.length === 0
        ? 'Low'
        : confidenceScore >= 55 && !invalidHits.length
        ? 'Medium'
        : 'High';

    const goodLawStatus = invalidHits.length
      ? 'Questionable — adverse signals found in retrieved material'
      : authoritative.length
      ? 'Supported by authoritative retrieved sources'
      : 'Supported by persuasive or secondary material only';

    const bindingAuthority = this.computeBindingAuthority(authorities);
    const now = new Date().toISOString();

    return {
      available: true,
      authorityStatus: riskLevel === 'Low' ? 'Verified' : riskLevel === 'Medium' ? 'Needs Review' : 'Uncertain',
      goodLawStatus,
      recentAmendments: amendmentHits.length
        ? `${amendmentHits.length} amendment signal(s) detected in retrieved material`
        : 'None detected in retrieved material',
      conflictingJudgments: conflictHits.length
        ? `${conflictHits.length} conflict signal(s) detected`
        : 'None detected in retrieved material',
      bindingAuthority,
      bindingCourt: bindingAuthority,
      citationAccuracy,
      confidenceScore,
      riskLevel,
      lastVerified: now,
      verificationTimestamp: now,
      primarySources: authorities.slice(0, 6).map((a) => a.title),
      citationValidation: citations.map((c) => ({
        citation: c.citation,
        status:
          c.support === 'retrieved'
            ? 'Grounded in retrieved source'
            : retrievedKeys.has(c.citation.toLowerCase())
            ? 'Cross-matched to retrieved material'
            : 'Generated — not independently supported by retrieval',
        paragraphSupport: c.excerpt ? 'Retrieved excerpt available' : 'No excerpt',
      })),
      unsupportedReasoning: unsupported.map(
        (c) => `Not found in retrieved authorities: ${c}`,
      ),
      professionalSummary: `Confidence ${confidenceScore}% from ${authorities.length} retrieved chunk(s). ` +
        `${invalidHits.length ? 'Adverse status signals detected — independent verification recommended. ' : ''}` +
        `Risk level: ${riskLevel}.`,
      details: {
        reason: `Top source: ${top.title}. Retrieval avg ${avgRetrieval.toFixed(2)}, reranker avg ${avgRerank.toFixed(2)}, authority avg ${avgAuthority.toFixed(2)}.`,
        latestAuthority: this.latestSource(authorities),
        relevantAmendment: amendmentHits.length ? amendmentHits.join('; ') : undefined,
        conflictingJudgment: conflictHits.length ? conflictHits.join('; ') : undefined,
        suggestedAuthority: top.citation || top.title,
      },
      sources: authorities.slice(0, 8).map((a) => ({
        name: a.citation || a.title,
        type: a.collection,
        authorityLevel: this.authorityLabel(a),
        date: a.date,
        status: invalidHits.some((s) =>
          `${a.title} ${a.chunkText}`.toLowerCase().includes(s),
        )
          ? 'Adverse status signal in source text'
          : 'Retrieved as supporting evidence',
        isValid: !invalidHits.some((s) =>
          `${a.title} ${a.chunkText}`.toLowerCase().includes(s),
        ),
      })),
      evidence: {
        retrievalScore: avgRetrieval,
        rerankerScore: avgRerank,
        authorityStrength: avgAuthority,
        citationCoverage,
        hallucinationPenalty,
        sourceCount: authorities.length,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private computeBindingAuthority(authorities: RetrievedAuthority[]): string {
    if (authorities.some((a) => a.collection === 'Constitution'))
      return 'Constitutional text — highest authority';
    const sc = authorities.find((a) => a.collection === 'Supreme Court Judgments');
    if (sc)
      return sc.benchStrength
        ? `Supreme Court of India (${sc.benchStrength}-judge bench)`
        : 'Supreme Court of India';
    if (authorities.some((a) => a.collection === 'Bare Acts'))
      return 'Statutory text (Central/State legislature)';
    if (authorities.some((a) => a.collection === 'High Court Judgments'))
      return 'High Court (binding in jurisdiction)';
    return 'Persuasive or secondary material';
  }

  private latestSource(authorities: RetrievedAuthority[]): string | undefined {
    const dated = authorities
      .filter((a) => a.date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const top = dated[0] ?? authorities[0];
    return top?.citation ?? top?.title;
  }

  private authorityLabel(a: RetrievedAuthority): string {
    if (a.collection === 'Constitution') return 'Constitutional Authority';
    if (a.collection === 'Supreme Court Judgments')
      return a.benchStrength
        ? `Supreme Court (${a.benchStrength}-judge bench)`
        : 'Supreme Court';
    if (a.collection === 'Bare Acts') return 'Statutory Text';
    if (a.collection === 'High Court Judgments') return 'High Court';
    if (a.collection === 'Law Commission Reports') return 'Law Commission';
    return 'Persuasive Source';
  }

  private extractCitationStrings(text: string): string[] {
    const matches =
      text.match(
        /\b(?:Article|Section)\s+\d+[A-Z]?(?:\([^)]+\))?|\b[A-Z][A-Za-z. &-]{2,70}\s+v\.?\s+[A-Z][A-Za-z. &-]{2,70}/g,
      ) ?? [];
    return [...new Set(matches.map((m) => m.trim()))];
  }

  private findSignals(text: string, signals: string[]): string[] {
    return signals.filter((s) => text.includes(s));
  }

  private avg(values: number[]): number {
    return values.length
      ? values.reduce((sum, v) => sum + v, 0) / values.length
      : 0;
  }

  private clamp(v: number): number {
    return Math.max(0, Math.min(1, v));
  }
}
