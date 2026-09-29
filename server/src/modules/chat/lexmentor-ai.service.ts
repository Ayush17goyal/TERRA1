/**
 * LexMentor AI Service — Pipeline Orchestrator
 *
 * This is the single entry point for every legal query.
 * It owns the 12-stage pipeline and guarantees:
 *
 *   1. Conversation Memory   — load history from Redis / DB
 *   2. Intent Detection      — LLM classification (zero regex)
 *   3. Query Rewriting       — HyDE + sub-query decomposition
 *   4. Hybrid Retrieval      — dense + HyDE + sub-query, RRF fusion
 *   5. Reranking             — semantic authority-weighted scoring
 *   6. Context Building      — token-budgeted prompt assembly
 *   7. Legal Reasoning       — LLM generation with streaming support
 *   8. Citation Generation   — anchor resolution + hallucination tagging
 *   9. Citation Verification — corpus-grounded authority analysis
 *  10. Response Formatting   — markdown finalization
 *  11. Store Conversation    — async persist to Redis + DB
 *  12. Analytics             — fire-and-forget telemetry
 *
 * INVARIANTS:
 *   - Never returns a hardcoded string answer.
 *   - Never uses keyword/regex matching to decide anything.
 *   - If the LLM call fails and no BYOK key is available, throws
 *     ServiceUnavailableException — never returns a fallback string.
 *   - Every stage is measured and logged individually.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConversationMemoryService } from './lexmentor/conversation-memory.service';
import { IntentClassifier } from './lexmentor/intent-classifier.service';
import { QueryRewriter } from './lexmentor/query-rewriter.service';
import { LegalRetriever } from './lexmentor/legal-retriever.service';
import { Reranker } from './lexmentor/reranker.service';
import { ContextBuilder } from './lexmentor/context-builder.service';
import { LegalReasoningEngine } from './lexmentor/legal-reasoning-engine.service';
import { CitationGenerator } from './lexmentor/citation-generator.service';
import { AuthorityVerificationEngine } from './lexmentor/authority-verification-engine.service';
import { ResponseFormatter } from './lexmentor/response-formatter.service';
import { PipelineAnalyticsService } from './lexmentor/analytics.service';
import { QueryValidator } from './lexmentor/query-validator.service';
import { LegalEvidenceValidator } from './lexmentor/legal-evidence-validator.service';
import {
  buildInsufficientConfidenceResponse,
  buildLegalEvidenceFailureResponse,
  buildNoRetrievalResponse,
  computeRetrievalConfidence,
  hasUploadedDocumentSources,
  RETRIEVAL_CONFIDENCE_THRESHOLD,
} from './lexmentor/lexmentor-policy';
import {
  AnswerDepth,
  LegacyCitation,
  LexMentorResult,
  PipelineContext,
  PipelineStage,
  RetrievedAuthority,
} from './lexmentor/pipeline.types';

export type { LexMentorResult };

export type LexMentorInput = {
  query: string;
  depth?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userId?: string;
  sessionId?: string;
  /** If provided, each token is pushed to this callback for SSE streaming */
  onToken?: (token: string) => void;
  references?: Array<{ id: string; content: string }>;
};

@Injectable()
export class LexMentorAiService {
  private readonly logger = new Logger(LexMentorAiService.name);

  constructor(
    private readonly memory: ConversationMemoryService,
    private readonly intentClassifier: IntentClassifier,
    private readonly queryRewriter: QueryRewriter,
    private readonly legalRetriever: LegalRetriever,
    private readonly reranker: Reranker,
    private readonly contextBuilder: ContextBuilder,
    private readonly reasoningEngine: LegalReasoningEngine,
    private readonly citationGenerator: CitationGenerator,
    private readonly verificationEngine: AuthorityVerificationEngine,
    private readonly formatter: ResponseFormatter,
    private readonly analytics: PipelineAnalyticsService,
    private readonly queryValidator: QueryValidator,
    private readonly legalEvidenceValidator: LegalEvidenceValidator,
  ) {}

  async generateResponse(input: LexMentorInput): Promise<LexMentorResult> {
    const requestId = this.genId('req');
    const depth = this.normalizeDepth(input.depth);

    // Initialise the pipeline context object — all stages read/write to this
    const ctx: PipelineContext = {
      requestId,
      userId: input.userId,
      sessionId: input.sessionId,
      rawQuery: input.query,
      depth,
      history: [],
      intent: 'General',
      intentConfidence: 0,
      retrievalConfidence: 0,
      fromUploadedDocument: false,
      skippedReasoning: false,
      legalEvidenceValidation: null,
      expanded: { original: input.query, subQueries: [], rewrittenQuery: input.query },
      rawAuthorities: [],
      rankedAuthorities: [],
      legalContext: { contextBlock: '', authorities: [], hasAuthoritativeSources: false, tokenEstimate: 0 },
      reasoning: { content: '', provider: '', model: '', promptTokens: 0, completionTokens: 0 },
      citations: [],
      verification: { available: false },
      formattedContent: '',
      startedAt: Date.now(),
      stageTimings: {},
      references: input.references || [],
    };

    // ── Stage 1: Conversation Memory ──────────────────────────────────────
    ctx.history = await this.timed(ctx, 'conversation_memory', async () => {
      const loaded = await this.memory.load(input.userId ?? 'anon', input.sessionId);
      // If caller passed explicit history (backward compat), merge it
      return loaded.length ? loaded : (input.history ?? []);
    });

    // ── Stage 2: Intent Detection ─────────────────────────────────────────
    const intentResult = await this.timed(ctx, 'intent_detection', () =>
      this.intentClassifier.classify(input.query),
    );
    ctx.intent = intentResult.intent;
    ctx.intentConfidence = intentResult.confidence;

    // ── Stage 2b: Query Validation ──────────────────────────────────────────
    const validation = await this.timed(ctx, 'query_validation', async () =>
      this.queryValidator.validate(input.query),
    );
    if (validation.needsClarification && validation.clarificationMessage) {
      ctx.skippedReasoning = true;
      ctx.formattedContent = validation.clarificationMessage;
      this.memory
        .save(
          input.userId ?? 'anon',
          input.sessionId,
          input.query,
          ctx.formattedContent,
          { intent: ctx.intent, provider: 'query-validator', model: 'local', requestId },
        )
        .catch((err) =>
          this.logger.warn(`Memory save failed: ${err instanceof Error ? err.message : String(err)}`),
        );
      this.analytics.record(ctx);
      return this.buildResult(ctx);
    }

    // ── Stage 3: Query Rewriting ──────────────────────────────────────────
    ctx.expanded = await this.timed(ctx, 'query_rewriter', () =>
      this.queryRewriter.rewrite(input.query, ctx.intent, ctx.history),
    );

    // ── Stage 4: Hybrid Retrieval ─────────────────────────────────────────
    ctx.rawAuthorities = await this.timed(ctx, 'hybrid_retrieval', () =>
      this.legalRetriever.retrieve(ctx.expanded, ctx.intent, input.userId),
    );

    // ── Stage 5: Reranking ────────────────────────────────────────────────
    ctx.rankedAuthorities = this.timed_sync(ctx, 'reranking', () =>
      this.reranker.rerank(ctx.intent, ctx.rawAuthorities),
    );

    // ── Stage 5b: Context Building ────────────────────────────────────────
    ctx.legalContext = this.timed_sync(ctx, 'context_build', () =>
      this.contextBuilder.build(input.query, ctx.intent, ctx.rankedAuthorities),
    );

    ctx.retrievalConfidence = computeRetrievalConfidence(ctx.rankedAuthorities);
    ctx.fromUploadedDocument = hasUploadedDocumentSources(ctx.rankedAuthorities);

    this.logger.log(
      `Pipeline [${requestId}]: intent=${ctx.intent}(${ctx.intentConfidence.toFixed(2)}) ` +
      `raw=${ctx.rawAuthorities.length} ranked=${ctx.rankedAuthorities.length} ` +
      `sources=${ctx.legalContext.hasAuthoritativeSources} confidence=${ctx.retrievalConfidence.toFixed(2)} depth=${depth}`,
    );

    // ── Mandatory RAG gate: validate retrieval but do not block generation for legal queries ────────
    ctx.legalEvidenceValidation = this.legalEvidenceValidator.validate({
      query: input.query,
      intent: ctx.intent,
      context: ctx.legalContext,
      retrievalConfidence: ctx.retrievalConfidence,
    });

    // ── Stage 6: Legal Reasoning ──────────────────────────────────────────
    // This is the only stage that calls the LLM for the actual answer.
    // If this throws (all providers failed), the exception propagates up
    // — the caller receives a structured 503, never a hardcoded message.
    ctx.reasoning = await this.timed(ctx, 'legal_reasoning', () =>
      this.reasoningEngine.generate({
        query: input.query,
        depth,
        intent: ctx.intent,
        context: ctx.legalContext,
        history: ctx.history,
        userId: input.userId,
        onToken: input.onToken,
        fromUploadedDocument: ctx.fromUploadedDocument,
        evidenceValidation: ctx.legalEvidenceValidation,
        references: ctx.references,
        retrievalConfidence: ctx.retrievalConfidence,
      }),
    );

    // ── Stage 7: Citation Generation ─────────────────────────────────────
    ctx.citations = this.timed_sync(ctx, 'citation_verification', () =>
      this.citationGenerator.extract(ctx.legalContext.authorities, ctx.reasoning.content),
    );

    // ── Stage 7b: Authority Verification ─────────────────────────────────
    ctx.verification = this.timed_sync(ctx, 'citation_verification', () =>
      this.verificationEngine.verify(
        ctx.legalContext.authorities,
        ctx.citations,
        ctx.reasoning.content,
      ),
    );

    // ── Stage 8: Response Formatting ─────────────────────────────────────
    ctx.formattedContent = this.timed_sync(ctx, 'response_format', () =>
      this.formatter.format(
        ctx.reasoning.content,
        ctx.intent,
        ctx.legalContext.authorities,
        ctx.citations,
        ctx.verification,
        ctx.retrievalConfidence,
        ctx.fromUploadedDocument,
      ),
    );

    this.persistAndReturn(ctx, input, requestId);
    return this.buildResult(ctx);
  }

  private persistAndReturn(ctx: PipelineContext, input: LexMentorInput, requestId: string): void {
    this.memory
      .save(
        input.userId ?? 'anon',
        input.sessionId,
        input.query,
        ctx.formattedContent,
        {
          intent: ctx.intent,
          provider: ctx.skippedReasoning ? 'rag-gate' : ctx.reasoning.provider,
          model: ctx.skippedReasoning ? 'local' : ctx.reasoning.model,
          requestId,
        },
      )
      .catch((err) =>
        this.logger.warn(`Memory save failed: ${err instanceof Error ? err.message : String(err)}`),
      );
    this.analytics.record(ctx);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Result assembly
  // ──────────────────────────────────────────────────────────────────────────

  private buildResult(ctx: PipelineContext): LexMentorResult {
    return {
      content: ctx.formattedContent,
      provider: ctx.skippedReasoning ? 'rag-gate' : ctx.reasoning.provider,
      model: ctx.skippedReasoning ? 'local' : ctx.reasoning.model,
      intent: ctx.intent,
      citations: this.toLegacyCitations(ctx.legalContext.authorities),
      supportingCitations: ctx.citations,
      retrievedAuthorities: ctx.legalContext.authorities,
      verification: ctx.verification.available ? ctx.verification : null,
      verificationPanelAvailable: ctx.legalContext.authorities.length > 0,
      legalEvidenceValidation: ctx.legalEvidenceValidation,
      pipelineMs: Date.now() - ctx.startedAt,
      requestId: ctx.requestId,
    };
  }

  private toLegacyCitations(authorities: RetrievedAuthority[]): LegacyCitation[] {
    return authorities.map((a, idx) => ({
      id: `A${idx + 1}`,
      source: a.citation ?? a.title,
      collection: a.collection,
      score: a.rerankerScore,
      excerpt: a.chunkText.slice(0, 500),
      metadata: {
        ...a.metadata,
        sourceId: a.id,
        retrievalScore: a.retrievalScore,
        rerankerScore: a.rerankerScore,
        authorityStrength: a.authorityStrength,
        court: a.court,
        date: a.date,
        page: a.page,
        section: a.section,
        article: a.article,
      },
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Timing helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async timed<T>(
    ctx: PipelineContext,
    stage: PipelineStage,
    fn: () => Promise<T>,
  ): Promise<T> {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      ctx.stageTimings[stage] = Date.now() - t0;
    }
  }

  private timed_sync<T>(
    ctx: PipelineContext,
    stage: PipelineStage,
    fn: () => T,
  ): T {
    const t0 = Date.now();
    try {
      return fn();
    } finally {
      ctx.stageTimings[stage] = (ctx.stageTimings[stage] ?? 0) + (Date.now() - t0);
    }
  }

  private normalizeDepth(depth?: string): AnswerDepth {
    if (depth === 'Beginner' || depth === 'Expert') return depth;
    return 'Intermediate';
  }

  private genId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }
}
