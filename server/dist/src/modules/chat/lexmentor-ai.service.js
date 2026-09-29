"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LexMentorAiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LexMentorAiService = void 0;
const common_1 = require("@nestjs/common");
const conversation_memory_service_1 = require("./lexmentor/conversation-memory.service");
const intent_classifier_service_1 = require("./lexmentor/intent-classifier.service");
const query_rewriter_service_1 = require("./lexmentor/query-rewriter.service");
const legal_retriever_service_1 = require("./lexmentor/legal-retriever.service");
const reranker_service_1 = require("./lexmentor/reranker.service");
const context_builder_service_1 = require("./lexmentor/context-builder.service");
const legal_reasoning_engine_service_1 = require("./lexmentor/legal-reasoning-engine.service");
const citation_generator_service_1 = require("./lexmentor/citation-generator.service");
const authority_verification_engine_service_1 = require("./lexmentor/authority-verification-engine.service");
const response_formatter_service_1 = require("./lexmentor/response-formatter.service");
const analytics_service_1 = require("./lexmentor/analytics.service");
const query_validator_service_1 = require("./lexmentor/query-validator.service");
const legal_evidence_validator_service_1 = require("./lexmentor/legal-evidence-validator.service");
const lexmentor_policy_1 = require("./lexmentor/lexmentor-policy");
let LexMentorAiService = LexMentorAiService_1 = class LexMentorAiService {
    constructor(memory, intentClassifier, queryRewriter, legalRetriever, reranker, contextBuilder, reasoningEngine, citationGenerator, verificationEngine, formatter, analytics, queryValidator, legalEvidenceValidator) {
        this.memory = memory;
        this.intentClassifier = intentClassifier;
        this.queryRewriter = queryRewriter;
        this.legalRetriever = legalRetriever;
        this.reranker = reranker;
        this.contextBuilder = contextBuilder;
        this.reasoningEngine = reasoningEngine;
        this.citationGenerator = citationGenerator;
        this.verificationEngine = verificationEngine;
        this.formatter = formatter;
        this.analytics = analytics;
        this.queryValidator = queryValidator;
        this.legalEvidenceValidator = legalEvidenceValidator;
        this.logger = new common_1.Logger(LexMentorAiService_1.name);
    }
    async generateResponse(input) {
        const requestId = this.genId('req');
        const depth = this.normalizeDepth(input.depth);
        const ctx = {
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
        ctx.history = await this.timed(ctx, 'conversation_memory', async () => {
            const loaded = await this.memory.load(input.userId ?? 'anon', input.sessionId);
            return loaded.length ? loaded : (input.history ?? []);
        });
        const intentResult = await this.timed(ctx, 'intent_detection', () => this.intentClassifier.classify(input.query));
        ctx.intent = intentResult.intent;
        ctx.intentConfidence = intentResult.confidence;
        const validation = await this.timed(ctx, 'query_validation', async () => this.queryValidator.validate(input.query));
        if (validation.needsClarification && validation.clarificationMessage) {
            ctx.skippedReasoning = true;
            ctx.formattedContent = validation.clarificationMessage;
            this.memory
                .save(input.userId ?? 'anon', input.sessionId, input.query, ctx.formattedContent, { intent: ctx.intent, provider: 'query-validator', model: 'local', requestId })
                .catch((err) => this.logger.warn(`Memory save failed: ${err instanceof Error ? err.message : String(err)}`));
            this.analytics.record(ctx);
            return this.buildResult(ctx);
        }
        ctx.expanded = await this.timed(ctx, 'query_rewriter', () => this.queryRewriter.rewrite(input.query, ctx.intent, ctx.history));
        ctx.rawAuthorities = await this.timed(ctx, 'hybrid_retrieval', () => this.legalRetriever.retrieve(ctx.expanded, ctx.intent, input.userId));
        ctx.rankedAuthorities = this.timed_sync(ctx, 'reranking', () => this.reranker.rerank(ctx.intent, ctx.rawAuthorities));
        ctx.legalContext = this.timed_sync(ctx, 'context_build', () => this.contextBuilder.build(input.query, ctx.intent, ctx.rankedAuthorities));
        ctx.retrievalConfidence = (0, lexmentor_policy_1.computeRetrievalConfidence)(ctx.rankedAuthorities);
        ctx.fromUploadedDocument = (0, lexmentor_policy_1.hasUploadedDocumentSources)(ctx.rankedAuthorities);
        this.logger.log(`Pipeline [${requestId}]: intent=${ctx.intent}(${ctx.intentConfidence.toFixed(2)}) ` +
            `raw=${ctx.rawAuthorities.length} ranked=${ctx.rankedAuthorities.length} ` +
            `sources=${ctx.legalContext.hasAuthoritativeSources} confidence=${ctx.retrievalConfidence.toFixed(2)} depth=${depth}`);
        ctx.legalEvidenceValidation = this.legalEvidenceValidator.validate({
            query: input.query,
            intent: ctx.intent,
            context: ctx.legalContext,
            retrievalConfidence: ctx.retrievalConfidence,
        });
        ctx.reasoning = await this.timed(ctx, 'legal_reasoning', () => this.reasoningEngine.generate({
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
        }));
        ctx.citations = this.timed_sync(ctx, 'citation_verification', () => this.citationGenerator.extract(ctx.legalContext.authorities, ctx.reasoning.content));
        ctx.verification = this.timed_sync(ctx, 'citation_verification', () => this.verificationEngine.verify(ctx.legalContext.authorities, ctx.citations, ctx.reasoning.content));
        ctx.formattedContent = this.timed_sync(ctx, 'response_format', () => this.formatter.format(ctx.reasoning.content, ctx.intent, ctx.legalContext.authorities, ctx.citations, ctx.verification, ctx.retrievalConfidence, ctx.fromUploadedDocument));
        this.persistAndReturn(ctx, input, requestId);
        return this.buildResult(ctx);
    }
    persistAndReturn(ctx, input, requestId) {
        this.memory
            .save(input.userId ?? 'anon', input.sessionId, input.query, ctx.formattedContent, {
            intent: ctx.intent,
            provider: ctx.skippedReasoning ? 'rag-gate' : ctx.reasoning.provider,
            model: ctx.skippedReasoning ? 'local' : ctx.reasoning.model,
            requestId,
        })
            .catch((err) => this.logger.warn(`Memory save failed: ${err instanceof Error ? err.message : String(err)}`));
        this.analytics.record(ctx);
    }
    buildResult(ctx) {
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
    toLegacyCitations(authorities) {
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
    async timed(ctx, stage, fn) {
        const t0 = Date.now();
        try {
            return await fn();
        }
        finally {
            ctx.stageTimings[stage] = Date.now() - t0;
        }
    }
    timed_sync(ctx, stage, fn) {
        const t0 = Date.now();
        try {
            return fn();
        }
        finally {
            ctx.stageTimings[stage] = (ctx.stageTimings[stage] ?? 0) + (Date.now() - t0);
        }
    }
    normalizeDepth(depth) {
        if (depth === 'Beginner' || depth === 'Expert')
            return depth;
        return 'Intermediate';
    }
    genId(prefix) {
        return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    }
};
exports.LexMentorAiService = LexMentorAiService;
exports.LexMentorAiService = LexMentorAiService = LexMentorAiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [conversation_memory_service_1.ConversationMemoryService,
        intent_classifier_service_1.IntentClassifier,
        query_rewriter_service_1.QueryRewriter,
        legal_retriever_service_1.LegalRetriever,
        reranker_service_1.Reranker,
        context_builder_service_1.ContextBuilder,
        legal_reasoning_engine_service_1.LegalReasoningEngine,
        citation_generator_service_1.CitationGenerator,
        authority_verification_engine_service_1.AuthorityVerificationEngine,
        response_formatter_service_1.ResponseFormatter,
        analytics_service_1.PipelineAnalyticsService,
        query_validator_service_1.QueryValidator,
        legal_evidence_validator_service_1.LegalEvidenceValidator])
], LexMentorAiService);
//# sourceMappingURL=lexmentor-ai.service.js.map