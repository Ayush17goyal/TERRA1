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
var LegalRetriever_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalRetriever = void 0;
const common_1 = require("@nestjs/common");
const bge_m3_provider_1 = require("../../retrieval/bge-m3.provider");
const qdrant_service_1 = require("../../retrieval/qdrant.service");
const legal_retrieval_service_1 = require("../../retrieval/legal-retrieval.service");
const COLLECTIONS = [
    {
        name: 'constitution',
        label: 'Constitution',
        authorityStrength: 1.0,
        intentAffinity: { 'Constitutional Law': 1.5, 'Research': 1.2, 'Moot Court': 1.2 },
    },
    {
        name: 'bare_acts',
        label: 'Bare Acts',
        authorityStrength: 0.96,
        intentAffinity: { 'Bare Act': 1.5, 'Contract': 1.2, 'Concept': 1.1 },
    },
    {
        name: 'acts',
        label: 'Bare Acts',
        authorityStrength: 0.93,
        intentAffinity: { 'Bare Act': 1.4, 'Contract': 1.1 },
    },
    {
        name: 'supreme_court_cases',
        label: 'Supreme Court Judgments',
        authorityStrength: 0.98,
        intentAffinity: { 'Case Law': 1.5, 'Constitutional Law': 1.3, 'Research': 1.3, 'Moot Court': 1.4 },
    },
    {
        name: 'judgments',
        label: 'Supreme Court Judgments',
        authorityStrength: 0.90,
        intentAffinity: { 'Case Law': 1.4, 'Constitutional Law': 1.2, 'Moot Court': 1.3 },
    },
    {
        name: 'high_court_cases',
        label: 'High Court Judgments',
        authorityStrength: 0.82,
        intentAffinity: { 'Case Law': 1.2, 'Research': 1.0 },
    },
    {
        name: 'law_commission_reports',
        label: 'Law Commission Reports',
        authorityStrength: 0.78,
        intentAffinity: { 'Research': 1.4, 'Bare Act': 1.1, 'Concept': 1.1 },
    },
    {
        name: 'research_papers',
        label: 'Research Papers',
        authorityStrength: 0.62,
        intentAffinity: { 'Research': 1.3, 'Moot Court': 1.1 },
    },
    {
        name: 'user_documents',
        label: 'User Uploaded Documents',
        authorityStrength: 1.0,
        intentAffinity: { General: 1.5, Drafting: 1.4, Contract: 1.3, Research: 1.2 },
    },
];
const RRF_K = 60;
const MIN_SCORE_THRESHOLD = 0.25;
const BASE_LIMIT_PER_COLLECTION = 6;
const BOOSTED_LIMIT_PER_COLLECTION = 10;
let LegalRetriever = LegalRetriever_1 = class LegalRetriever {
    constructor(qdrantService, embedProvider, legalRetrievalService) {
        this.qdrantService = qdrantService;
        this.embedProvider = embedProvider;
        this.legalRetrievalService = legalRetrievalService;
        this.logger = new common_1.Logger(LegalRetriever_1.name);
    }
    async retrieve(expanded, intent, userId) {
        const central = await this.legalRetrievalService.retrieveLegalContext(expanded.original || expanded.rewrittenQuery, 12);
        if (central.provisions.length > 0) {
            this.logger.debug(`Central legal retrieval supplied ${central.provisions.length} provision(s).`);
            return central.provisions.map((provision) => this.provisionToAuthority(provision));
        }
        if (central.detectedActId && central.detectedNumber) {
            this.logger.warn(`Central legal retrieval found no exact provision for act_id=${central.detectedActId} ${central.detectedType}=${central.detectedNumber}; refusing legacy broad retrieval.`);
            return [];
        }
        if (!this.embedProvider.isAvailable()) {
            this.logger.warn('Retrieval skipped: no embedding provider available.');
            return [];
        }
        let primaryVector;
        try {
            primaryVector = await this.embedProvider.generateEmbedding(expanded.rewrittenQuery);
        }
        catch (err) {
            this.logger.error(`Primary embedding failed: ${this.msg(err)}`);
            return [];
        }
        const searchPasses = [
            { label: 'primary', vector: primaryVector },
        ];
        if (expanded.hydeVector) {
            searchPasses.push({ label: 'hyde', vector: expanded.hydeVector });
        }
        for (const [idx, subQuery] of expanded.subQueries.entries()) {
            try {
                const vec = await this.embedProvider.generateEmbedding(subQuery);
                searchPasses.push({ label: `sub_${idx}`, vector: vec });
            }
            catch {
            }
        }
        this.logger.debug(`Retrieval: ${searchPasses.length} search pass(es) across ${COLLECTIONS.length} collections`);
        const userDocResults = [];
        if (userId) {
            for (const pass of searchPasses) {
                const userHits = await this.searchAllCollections(pass.vector, intent, userId, pass.label, ['user_documents']);
                userDocResults.push(...userHits);
            }
        }
        const allPassResults = await Promise.all(searchPasses.map((pass) => this.searchAllCollections(pass.vector, intent, userId, pass.label)));
        const rrfMerged = this.reciprocalRankFusion([userDocResults, ...allPassResults]);
        this.logger.debug(`Retrieval: ${rrfMerged.length} unique chunks after RRF merge`);
        return rrfMerged.slice(0, 48);
    }
    provisionToAuthority(provision) {
        return {
            id: `legal_corpus:${provision.id}`,
            collection: 'Bare Acts',
            collectionName: qdrant_service_1.QdrantService.COLLECTION,
            title: `${provision.actName}${provision.section ? ` Section ${provision.section}` : ''}${provision.title ? ` - ${provision.title}` : ''}`,
            citation: provision.section ? `${provision.actName}, Section ${provision.section}` : provision.actName,
            section: provision.section || undefined,
            chunkText: provision.content,
            retrievalScore: provision.score,
            rerankerScore: provision.score,
            authorityStrength: 0.96,
            metadata: {
                source: 'central_legal_retrieval',
                act_id: provision.actId,
                act_name: provision.actName,
                category: provision.category,
                part: provision.part,
                chapter: provision.chapter,
                section: provision.section,
                subsection: provision.subsection,
                clause: provision.clause,
                title: provision.title,
                keywords: provision.keywords,
            },
        };
    }
    async searchAllCollections(vector, intent, userId, passLabel, onlyCollections) {
        const client = this.qdrantService.getClient();
        const hits = [];
        const collections = onlyCollections
            ? COLLECTIONS.filter((c) => onlyCollections.includes(c.name))
            : COLLECTIONS;
        await Promise.all(collections.map(async (collection) => {
            const affinity = collection.intentAffinity[intent] ?? 1.0;
            const limit = affinity >= 1.3
                ? BOOSTED_LIMIT_PER_COLLECTION
                : BASE_LIMIT_PER_COLLECTION;
            const filter = collection.name === 'user_documents' && userId
                ? { must: [{ key: 'user_id', match: { value: userId } }] }
                : undefined;
            try {
                const results = await client.search(collection.name, {
                    vector,
                    limit,
                    with_payload: true,
                    filter,
                });
                for (const result of results) {
                    const rawScore = Number(result.score ?? 0);
                    if (rawScore < MIN_SCORE_THRESHOLD)
                        continue;
                    const payload = (result.payload ?? {});
                    const chunkText = this.extractText(payload);
                    if (!chunkText)
                        continue;
                    hits.push({
                        id: `${collection.name}:${String(result.id)}`,
                        collection: collection.label,
                        collectionName: collection.name,
                        title: this.extractTitle(collection.label, payload, result.id),
                        citation: this.firstStr(payload.citation, payload.neutralCitation, payload.caseCitation),
                        court: this.firstStr(payload.court, payload.courtName),
                        date: this.firstStr(payload.date, payload.judgmentDate, payload.year),
                        benchStrength: Number(payload.benchStrength ?? payload.bench_size ?? 0) || undefined,
                        sourceDocument: this.firstStr(payload.sourceDocument, payload.documentName, payload.fileName),
                        page: this.firstStr(payload.page, payload.pageNumber),
                        section: this.firstStr(payload.section, payload.sectionNumber),
                        article: this.firstStr(payload.article, payload.articleNumber),
                        chunkText,
                        retrievalScore: rawScore,
                        rerankerScore: rawScore,
                        authorityStrength: collection.authorityStrength,
                        metadata: payload,
                    });
                }
            }
            catch (err) {
                this.logger.warn(`Qdrant search failed [${passLabel}/${collection.name}]: ${this.msg(err)}`);
            }
        }));
        return hits.sort((a, b) => b.retrievalScore - a.retrievalScore);
    }
    reciprocalRankFusion(passedLists) {
        const rrfScores = new Map();
        const authorityMap = new Map();
        for (const list of passedLists) {
            list.forEach((authority, rank) => {
                const score = 1 / (RRF_K + rank + 1);
                rrfScores.set(authority.id, (rrfScores.get(authority.id) ?? 0) + score);
                const existing = authorityMap.get(authority.id);
                if (!existing || authority.retrievalScore > existing.retrievalScore) {
                    authorityMap.set(authority.id, authority);
                }
            });
        }
        return Array.from(rrfScores.entries())
            .sort(([, a], [, b]) => b - a)
            .map(([id, rrfScore]) => {
            const authority = authorityMap.get(id);
            return { ...authority, retrievalScore: rrfScore };
        });
    }
    extractText(payload) {
        return (this.firstStr(payload.text, payload.content, payload.pageContent, payload.chunk, payload.summary, payload.body)
            ?.replace(/\s+/g, ' ')
            .trim() ?? '');
    }
    extractTitle(collection, payload, pointId) {
        return (this.firstStr(payload.title, payload.name, payload.caseName, payload.actName, payload.documentName, payload.fileName) ?? `${collection} #${String(pointId)}`);
    }
    firstStr(...values) {
        for (const v of values) {
            if (typeof v === 'string' && v.trim())
                return v.trim();
            if (typeof v === 'number')
                return String(v);
        }
        return undefined;
    }
    msg(err) {
        return err instanceof Error ? err.message : String(err);
    }
};
exports.LegalRetriever = LegalRetriever;
exports.LegalRetriever = LegalRetriever = LegalRetriever_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [qdrant_service_1.QdrantService,
        bge_m3_provider_1.BgeM3Provider,
        legal_retrieval_service_1.LegalRetrievalService])
], LegalRetriever);
//# sourceMappingURL=legal-retriever.service.js.map