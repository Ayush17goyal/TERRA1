/**
 * Stage 7a — Citation Generator
 *
 * Extracts citations from the generated answer and the retrieved authorities.
 *
 * Two sources of citations:
 *  1. RETRIEVED: citations present in the authority chunks (section numbers,
 *     article numbers, case names, neutral citations). These are always marked
 *     support='retrieved' and verified=true.
 *
 *  2. GENERATED: citations the LLM wrote in its answer that were NOT in the
 *     retrieved material. These are marked support='generated' and
 *     verified=false — they require cross-checking.
 *
 * The anchor resolution pass resolves [A1], [A2] markers written by the LLM
 * back to their source authority, giving the UI exact document links.
 */

import { Injectable } from '@nestjs/common';
import { ExtractedCitation, RetrievedAuthority } from './pipeline.types';

// Matches Indian legal citation patterns
const CITATION_PATTERNS: Array<{ type: ExtractedCitation['type']; regex: RegExp }> = [
  // Article 19(1)(a), Article 32, etc.
  { type: 'article', regex: /\bArticle\s+\d+[A-Z]?(?:\(\d+\)(?:[a-z])?)?/gi },
  // Section 302, Section 10A, Section 6(1)(b), etc.
  { type: 'section', regex: /\bSection\s+\d+[A-Z]?(?:\([^)]{1,20}\))?/gi },
  // Neutral citations: AIR 1973 SC 1461, (2019) 11 SCC 1, INSC 123, etc.
  { type: 'source_document', regex: /\b(?:AIR|SCC|SCR|CriLJ|INSC|MANU|SCC OnLine)\s+[\dA-Z/().:\s-]{4,60}/g },
  // Case names: Kesavananda Bharati v. State of Kerala
  {
    type: 'case',
    regex: /\b[A-Z][A-Za-z. ]{2,50}\s+v\.?\s+[A-Z][A-Za-z. ]{2,50}(?:\s*,?\s*\(?\d{4}\)?)?/g,
  },
];

/** Anchor tag [A1] written by the LLM */
const ANCHOR_REGEX = /\[A(\d+)\]/g;

@Injectable()
export class CitationGenerator {
  extract(
    authorities: RetrievedAuthority[],
    generatedAnswer = '',
  ): ExtractedCitation[] {
    const citations = new Map<string, ExtractedCitation>();

    // ── 1. Retrieved citations ─────────────────────────────────────────────
    authorities.forEach((authority, idx) => {
      const sourceId = authority.id;
      const excerpt = authority.chunkText.slice(0, 300);
      const anchorId = `A${idx + 1}`;

      if (authority.citation) {
        this.upsert(citations, {
          id: `retrieved-${anchorId}-citation`,
          citation: authority.citation,
          type: /Judgments/.test(authority.collection) ? 'case' : 'source_document',
          sourceId,
          support: 'retrieved',
          excerpt,
          verified: true,
        });
      }

      if (authority.article) {
        this.upsert(citations, {
          id: `retrieved-${anchorId}-article`,
          citation: `Article ${authority.article}`,
          type: 'article',
          sourceId,
          support: 'retrieved',
          excerpt,
          verified: true,
        });
      }

      if (authority.section) {
        this.upsert(citations, {
          id: `retrieved-${anchorId}-section`,
          citation: `Section ${authority.section}`,
          type: 'section',
          sourceId,
          support: 'retrieved',
          excerpt,
          verified: true,
        });
      }

      // Extract additional citations from the chunk text
      this.extractFromText(authority.chunkText, sourceId, excerpt, 'retrieved').forEach((c) =>
        this.upsert(citations, c),
      );
    });

    // ── 2. LLM anchor resolution [A1], [A2] ───────────────────────────────
    this.resolveAnchors(generatedAnswer, authorities).forEach((c) => this.upsert(citations, c));

    // ── 3. Generated citations (LLM added, not in retrieved material) ──────
    this.extractFromText(generatedAnswer, undefined, undefined, 'generated').forEach((c) => {
      // Only add if not already present as a retrieved citation
      const key = this.citationKey(c);
      if (!citations.has(key)) {
        this.upsert(citations, { ...c, verified: false });
      }
    });

    return Array.from(citations.values()).slice(0, 40);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private resolveAnchors(
    answer: string,
    authorities: RetrievedAuthority[],
  ): ExtractedCitation[] {
    const result: ExtractedCitation[] = [];
    let match: RegExpExecArray | null;
    // Reset stateful regex
    ANCHOR_REGEX.lastIndex = 0;
    const regex = new RegExp(ANCHOR_REGEX.source, 'g');

    while ((match = regex.exec(answer)) !== null) {
      const authorityIdx = parseInt(match[1], 10) - 1;
      const authority = authorities[authorityIdx];
      if (!authority) continue;

      result.push({
        id: `anchor-A${authorityIdx + 1}`,
        citation: authority.citation || authority.title,
        type: /Judgments/.test(authority.collection) ? 'case' : 'source_document',
        sourceId: authority.id,
        support: 'retrieved',
        excerpt: authority.chunkText.slice(0, 200),
        verified: true,
      });
    }

    return result;
  }

  private extractFromText(
    text: string,
    sourceId?: string,
    excerpt?: string,
    support: 'retrieved' | 'generated' = 'retrieved',
  ): ExtractedCitation[] {
    const found: ExtractedCitation[] = [];

    for (const { type, regex } of CITATION_PATTERNS) {
      const cloned = new RegExp(regex.source, regex.flags);
      let match: RegExpExecArray | null;
      while ((match = cloned.exec(text)) !== null) {
        const citation = match[0].replace(/\s+/g, ' ').trim();
        if (citation.length < 4) continue;
        found.push({
          id: `${type}-${sourceId ?? 'ans'}-${found.length}`,
          citation,
          type,
          sourceId,
          support,
          excerpt,
          verified: support === 'retrieved',
        });
      }
    }

    return found;
  }

  private upsert(map: Map<string, ExtractedCitation>, citation: ExtractedCitation): void {
    const key = this.citationKey(citation);
    // Retrieved citations take precedence over generated ones
    const existing = map.get(key);
    if (!existing || (citation.support === 'retrieved' && existing.support === 'generated')) {
      map.set(key, citation);
    }
  }

  private citationKey(c: ExtractedCitation): string {
    return `${c.type}:${c.citation.toLowerCase().replace(/\s+/g, ' ').trim()}`;
  }
}
