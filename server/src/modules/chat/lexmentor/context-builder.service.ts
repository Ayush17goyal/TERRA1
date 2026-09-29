/**
 * Stage 5b — Context Builder
 *
 * Takes the reranked authorities and assembles a structured context block
 * that will be injected into the LLM's user prompt.
 *
 * Key responsibilities:
 *  - Token budget management: never exceed ~8,000 chars of context
 *  - Citation anchoring: every chunk gets a [A1], [A2] marker that the
 *    LLM is instructed to reference in its answer
 *  - Authority precedence: higher-authority sources appear first
 */

import { Injectable } from '@nestjs/common';
import { BuiltLegalContext, LegalIntent, RetrievedAuthority } from './pipeline.types';

const MAX_CONTEXT_CHARS = 8000;
const MAX_CHUNK_CHARS = 1000;

@Injectable()
export class ContextBuilder {
  build(
    query: string,
    intent: LegalIntent,
    authorities: RetrievedAuthority[],
  ): BuiltLegalContext {
    const selected = this.selectWithinBudget(authorities);

    const contextLines: string[] = [];
    let charCount = 0;

    for (const [idx, authority] of selected.entries()) {
      const refs = [
        authority.citation,
        authority.section ? `Section ${authority.section}` : undefined,
        authority.article ? `Article ${authority.article}` : undefined,
        authority.page ? `Page ${authority.page}` : undefined,
      ]
        .filter(Boolean)
        .join(' | ');

      const lines = [
        `[A${idx + 1}] ${authority.collection}: ${authority.title}`,
        refs ? `Reference: ${refs}` : undefined,
        authority.court ? `Court: ${authority.court}` : undefined,
        authority.date ? `Date: ${authority.date}` : undefined,
        `Excerpt: ${this.truncate(authority.chunkText, MAX_CHUNK_CHARS)}`,
      ]
        .filter(Boolean)
        .join('\n');

      charCount += lines.length + 2;
      if (charCount > MAX_CONTEXT_CHARS) break;
      contextLines.push(lines);
    }

    const contextBlock = contextLines.join('\n\n');
    const tokenEstimate = Math.ceil(contextBlock.length / 3.5);

    return {
      contextBlock,
      authorities: selected.slice(0, contextLines.length),
      hasAuthoritativeSources: contextLines.length > 0,
      tokenEstimate,
    };
  }

  /**
   * Fit as many chunks as possible within the token budget,
   * always keeping the highest-scoring ones.
   */
  private selectWithinBudget(authorities: RetrievedAuthority[]): RetrievedAuthority[] {
    // Uploaded documents always take precedence
    const userDocs = authorities.filter((a) => a.collection === 'User Uploaded Documents');
    const others = authorities.filter((a) => a.collection !== 'User Uploaded Documents');
    const ordered = [...userDocs, ...others];

    let budget = MAX_CONTEXT_CHARS;
    const selected: RetrievedAuthority[] = [];
    for (const authority of ordered) {
      const size = Math.min(authority.chunkText.length, MAX_CHUNK_CHARS) + 150; // 150 for metadata
      if (budget - size < 0) break;
      budget -= size;
      selected.push(authority);
    }
    return selected;
  }

  private truncate(text: string, maxLen: number): string {
    const norm = (text ?? '').replace(/\s+/g, ' ').trim();
    return norm.length <= maxLen ? norm : `${norm.slice(0, maxLen - 1)}…`;
  }
}
