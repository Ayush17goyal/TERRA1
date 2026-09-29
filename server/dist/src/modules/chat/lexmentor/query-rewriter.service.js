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
var QueryRewriter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryRewriter = void 0;
const common_1 = require("@nestjs/common");
const openrouter_ai_provider_service_1 = require("../openrouter-ai-provider.service");
const bge_m3_provider_1 = require("../../retrieval/bge-m3.provider");
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
let QueryRewriter = QueryRewriter_1 = class QueryRewriter {
    constructor(aiProvider, embedProvider) {
        this.aiProvider = aiProvider;
        this.embedProvider = embedProvider;
        this.logger = new common_1.Logger(QueryRewriter_1.name);
    }
    async rewrite(query, intent, history) {
        const [hydeResult, decomposeResult] = await Promise.allSettled([
            this.generateHydeVector(query),
            this.decomposeQuery(query, intent),
        ]);
        const hydeVector = hydeResult.status === 'fulfilled' ? hydeResult.value : undefined;
        const subQueries = decomposeResult.status === 'fulfilled' ? decomposeResult.value : [];
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
    async generateHydeVector(query) {
        if (!this.embedProvider.isAvailable())
            return undefined;
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
    async decomposeQuery(query, intent) {
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
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed.subQueries)) {
                return parsed.subQueries
                    .filter((q) => typeof q === 'string' && q.trim().length > 0)
                    .slice(0, 3);
            }
        }
        catch {
            this.logger.warn(`Sub-query decompose parse failed for: ${query.slice(0, 60)}`);
        }
        return [];
    }
    buildRetrievalQuery(query, intent, history) {
        const isContinuation = query.split(/\s+/).length < 8 &&
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
    msg(err) {
        return err instanceof Error ? err.message : String(err);
    }
};
exports.QueryRewriter = QueryRewriter;
exports.QueryRewriter = QueryRewriter = QueryRewriter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openrouter_ai_provider_service_1.OpenRouterAiProviderService,
        bge_m3_provider_1.BgeM3Provider])
], QueryRewriter);
//# sourceMappingURL=query-rewriter.service.js.map