/**
 * Stage 3 — Query Rewriter
 *
 * Applies two techniques before retrieval:
 *
 * 1. HyDE (Hypothetical Document Embeddings)
 *    Ask the LLM to generate a short hypothetical answer to the query,
 *    then embed that answer instead of (or in addition to) the raw question.
 *    Legal answers share vocabulary with legal sources, so the hypothetical
 *    answer vector lands closer to relevant chunks in the vector space.
 *
 * 2. Sub-query Decomposition
 *    Complex queries (e.g. "What are the limits of Article 19 and how have
 *    courts applied them?") decompose into atomic sub-queries that each
 *    retrieve their own result set. Results are merged and deduplicated.
 *
 * Both techniques are optional: if the LLM call fails, the original query
 * is used directly, so the pipeline never blocks here.
 */

import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterAiProviderService } from '../openrouter-ai-provider.service';
import { BgeM3Provider } from '../../retrieval/bge-m3.provider';
import { ExpandedQueries, LegalIntent } from './pipeline.types';

const HYDE_SYSTEM_PROMPT = `You are a legal expert generating a concise hypothetical source excerpt that would directly answer the user's legal query.

Write as if you are quoting from a legal textbook, judgment, or statute — not answering as an AI.
Keep the response to 150–200 words.
Include relevant legal terminology, act names, section numbers, and case names that would appear in real legal sources.
Do NOT acknowledge the query, explain your approach, or add commentary.
Output only the hypothetical excerpt.`;

const DECOMPOSE_SYSTEM_PROMPT = `You are a legal research assistant.

Decompose the user's query into at most 3 atomic sub-queries, each targeting a distinct factual or legal aspect.
Each sub-query must be self-contained and retrievable independently.

Output JSON only — no prose, no markdown:
{ "subQueries": ["...", "...", "..."] }

Rules:
- If the query is already atomic (single issue), return exactly: { "subQueries": [] }
- Never output more than 3 sub-queries.
- Each sub-query must be a complete sentence or phrase.`;

@Injectable()
export class QueryRewriter {
  private readonly logger = new Logger(QueryRewriter.name);

  constructor(
    private readonly aiProvider: OpenRouterAiProviderService,
    private readonly embedProvider: BgeM3Provider,
  ) {}

  async rewrite(
    query: string,
    intent: LegalIntent,
    history: Array<{ role: string; content: string }>,
  ): Promise<ExpandedQueries> {
    const [hydeResult, decomposeResult] = await Promise.allSettled([
      this.generateHydeVector(query),
      this.decomposeQuery(query, intent),
    ]);

    const hydeVector =
      hydeResult.status === 'fulfilled' ? hydeResult.value : undefined;

    const subQueries =
      decomposeResult.status === 'fulfilled' ? decomposeResult.value : [];

    if (hydeResult.status === 'rejected') {
      this.logger.warn(`HyDE generation failed: ${this.msg(hydeResult.reason)}`);
    }
    if (decomposeResult.status === 'rejected') {
      this.logger.warn(`Query decomposition failed: ${this.msg(decomposeResult.reason)}`);
    }

    return {
      original: query,
      hydeVector,
      subQueries,
      rewrittenQuery: this.buildRetrievalQuery(query, intent, history),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HyDE
  // ──────────────────────────────────────────────────────────────────────────

  private async generateHydeVector(query: string): Promise<number[] | undefined> {
    if (!this.embedProvider.isAvailable()) return undefined;

    const hypotheticalDoc = await this.aiProvider.complete({
      module: 'lexmentor',
      temperature: 0.1,
      maxTokens: 300,
      timeoutMs: 7000,
      preferredModel: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: HYDE_SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
    });

    if (!hypotheticalDoc.content || hypotheticalDoc.content.length < 20) {
      return undefined;
    }

    this.logger.debug(`HyDE doc generated (${hypotheticalDoc.content.length} chars)`);
    return this.embedProvider.generateEmbedding(hypotheticalDoc.content);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Sub-query decomposition
  // ──────────────────────────────────────────────────────────────────────────

  private async decomposeQuery(query: string, intent: LegalIntent): Promise<string[]> {
    // Single-aspect intents rarely benefit from decomposition
    if (['Bare Act', 'Concept', 'Drafting', 'Contract'].includes(intent)) {
      return [];
    }

    const result = await this.aiProvider.complete({
      module: 'lexmentor',
      temperature: 0,
      maxTokens: 150,
      timeoutMs: 5000,
      preferredModel: 'google/gemini-2.5-flash',
      jsonMode: true,
      messages: [
        { role: 'system', content: DECOMPOSE_SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
    });

    try {
      const cleaned = result.content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const parsed = JSON.parse(cleaned) as { subQueries?: unknown };
      if (Array.isArray(parsed.subQueries)) {
        return (parsed.subQueries as unknown[])
          .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
          .slice(0, 3);
      }
    } catch {
      this.logger.warn(`Sub-query decompose parse failed for: ${query.slice(0, 60)}`);
    }
    return [];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Rewritten retrieval query
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Build a retrieval-optimized string.
   * This handles conversational queries like "what about Article 21?" where
   * context from prior turns is needed to make the query self-contained.
   */
  private buildRetrievalQuery(
    query: string,
    intent: LegalIntent,
    history: Array<{ role: string; content: string }>,
  ): string {
    // If the query appears to be a follow-up (short and pronoun-heavy),
    // prepend the most recent user turn as context.
    const isContinuation =
      query.split(/\s+/).length < 8 &&
      /^(what|how|why|is|are|can|and|but|also|tell me|explain|give|show|more about|what about)\b/i.test(query.trim());

    if (isContinuation && history.length >= 2) {
      const lastUserTurn = history
        .filter((m) => m.role === 'user')
        .slice(-1)[0];
      if (lastUserTurn && lastUserTurn.content !== query) {
        return `${lastUserTurn.content} — specifically: ${query}`;
      }
    }

    return query;
  }

  private msg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
