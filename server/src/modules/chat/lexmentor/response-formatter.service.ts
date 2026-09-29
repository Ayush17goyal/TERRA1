/**
 * Stage 8 — Response Formatter
 *
 * Produces the final markdown delivered to the client with mandatory sections:
 * Sources, Confidence Level, and legal-education disclaimer.
 * Strips citations that failed validation.
 */

import { Injectable } from '@nestjs/common';
import {
  formatConfidenceLevel,
  LEXMENTOR_LEGAL_DISCLAIMER,
  LEXMENTOR_UPLOADED_DOC_NOTE,
} from './lexmentor-policy';
import {
  AuthorityVerification,
  ExtractedCitation,
  LegalIntent,
  RetrievedAuthority,
} from './pipeline.types';

@Injectable()
export class ResponseFormatter {
  format(
    content: string,
    intent: LegalIntent,
    authorities: RetrievedAuthority[],
    citations: ExtractedCitation[],
    verification: AuthorityVerification,
    retrievalConfidence = 0,
    fromUploadedDocument = false,
  ): string {
    let resolved = this.resolveAnchors(content, authorities);
    resolved = this.stripUnverifiedCitations(resolved, citations);

    const sections: string[] = [];

    if (fromUploadedDocument) {
      sections.push(`*${LEXMENTOR_UPLOADED_DOC_NOTE}*`, '');
    }

    sections.push(resolved.trim());

    const sourcesBlock = this.buildSourcesBlock(authorities, verification);
    if (sourcesBlock) sections.push(sourcesBlock);

    sections.push(
      '## Confidence Level',
      formatConfidenceLevel(retrievalConfidence),
      '',
      '---',
      LEXMENTOR_LEGAL_DISCLAIMER,
    );

    return sections.join('\n\n');
  }

  templateFor(intent: LegalIntent): string {
    const templates: Record<LegalIntent, string> = {
      Concept:
        'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
      'Bare Act':
        'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
      'Case Law':
        'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
      'Constitutional Law':
        'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
      Research:
        'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
      Drafting:
        'Answer → Legal Explanation → Relevant Provision(s) → Practical Example → Important Notes → Sources → Confidence Level',
      Contract:
        'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
      'Moot Court':
        'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation → Practical Example → Important Notes → Sources → Confidence Level',
      General:
        'Answer → Legal Explanation → Relevant Provision(s) → Judicial Interpretation (if available) → Practical Example → Important Notes → Sources → Confidence Level',
    };
    return templates[intent];
  }

  private resolveAnchors(content: string, authorities: RetrievedAuthority[]): string {
    return content.replace(/\[A(\d+)\]/g, (_match, numStr) => {
      const idx = parseInt(numStr, 10) - 1;
      const authority = authorities[idx];
      if (!authority) return `[A${numStr}]`;
      const label = authority.citation || authority.title;
      return `*(${label})*`;
    });
  }

  /**
   * Remove generated citations not grounded in retrieved material.
   */
  private stripUnverifiedCitations(content: string, citations: ExtractedCitation[]): string {
    const unverified = citations.filter((c) => c.support === 'generated' && !c.verified);
    let result = content;
    for (const citation of unverified) {
      const escaped = citation.citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'gi'), '[citation removed — not verified in retrieved sources]');
    }
    return result;
  }

  private buildSourcesBlock(
    authorities: RetrievedAuthority[],
    verification: AuthorityVerification,
  ): string {
    if (!authorities.length) return '';

    const lines: string[] = ['## Sources'];

    authorities.slice(0, 8).forEach((a, idx) => {
      const reference = a.section
        ? `Section ${a.section}`
        : a.article
        ? `Article ${a.article}`
        : a.page
        ? `Page ${a.page}`
        : '';
      const court = a.court ? ` [${a.court}]` : '';
      const date = a.date ? ` (${a.date})` : '';
      const refSuffix = reference ? ` — ${reference}` : '';

      lines.push(`${idx + 1}. **${a.title}** — *${a.collection}${refSuffix}*${court}${date}`);
    });

    if (verification.available && verification.riskLevel) {
      lines.push('');
      const emoji = { Low: '✅', Medium: '⚠️', High: '⛔' }[verification.riskLevel];
      lines.push(
        `${emoji} **Citation Validation:** ${verification.confidenceScore}% confidence · Risk: ${verification.riskLevel}`,
      );
    }

    return lines.join('\n');
  }
}
