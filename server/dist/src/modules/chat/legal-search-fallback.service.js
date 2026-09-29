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
var LegalSearchFallbackService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalSearchFallbackService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
const legal_source_types_1 = require("./legal-source.types");
const semantic_cache_service_1 = require("./semantic-cache.service");
let LegalSearchFallbackService = LegalSearchFallbackService_1 = class LegalSearchFallbackService {
    constructor(cacheService) {
        this.cacheService = cacheService;
        this.logger = new common_1.Logger(LegalSearchFallbackService_1.name);
        this.strongQdrantConfidence = 0.75;
        this.minAuthoritativeConfidence = 0.6;
        this.minGeneralConfidence = 0.7;
        this.trustedTiers = [
            {
                tier: 2,
                sourceType: 'supreme_court',
                label: 'Supreme Court Sources',
                domains: ['sci.gov.in', 'main.sci.gov.in'],
                minConfidence: this.minAuthoritativeConfidence,
            },
            {
                tier: 3,
                sourceType: 'india_code',
                label: 'India Code',
                domains: ['indiacode.nic.in'],
                minConfidence: this.minAuthoritativeConfidence,
            },
            {
                tier: 4,
                sourceType: 'law_commission',
                label: 'Law Commission Reports',
                domains: ['lawcommissionofindia.nic.in'],
                minConfidence: this.minAuthoritativeConfidence,
            },
            {
                tier: 5,
                sourceType: 'government_repository',
                label: 'Government Legal Repositories',
                domains: ['legislative.gov.in', 'egazette.nic.in', 'doj.gov.in', 'lawmin.gov.in'],
                minConfidence: this.minAuthoritativeConfidence,
            },
        ];
        this.generalLegalDomains = [
            'indiankanoon.org',
            'barandbench.com',
            'livelaw.in',
        ];
    }
    async search(query, qdrantSources = []) {
        const strongQdrantSources = qdrantSources.filter((source) => source.confidenceScore >= this.strongQdrantConfidence);
        if (strongQdrantSources.length > 0) {
            return this.rankAndDedupe(qdrantSources);
        }
        const cached = await this.cacheService.getLegalReferences(query);
        const cachedAuthoritative = (cached || []).filter((source) => source.tier >= 2 && source.tier <= 5);
        const cachedGeneral = (cached || []).filter((source) => source.tier === 6);
        if (cachedAuthoritative.length > 0) {
            return this.rankAndDedupe([...qdrantSources, ...cachedAuthoritative]);
        }
        const discovered = [];
        for (const tier of this.trustedTiers) {
            const tierSources = await this.searchTier(query, tier);
            const usableSources = tierSources.filter((source) => source.confidenceScore >= tier.minConfidence);
            if (usableSources.length > 0) {
                discovered.push(...usableSources);
                const ranked = this.rankAndDedupe([...qdrantSources, ...discovered]);
                await this.cacheService.setLegalReferences(query, ranked.filter((source) => source.tier > 1));
                return ranked;
            }
        }
        if (cachedGeneral.length > 0) {
            return this.rankAndDedupe([...qdrantSources, ...cachedGeneral]);
        }
        const generalSources = await this.searchGeneralLegalSources(query);
        const usableGeneralSources = generalSources.filter((source) => source.confidenceScore >= this.minGeneralConfidence);
        const ranked = this.rankAndDedupe([...qdrantSources, ...usableGeneralSources]);
        if (usableGeneralSources.length > 0) {
            await this.cacheService.setLegalReferences(query, usableGeneralSources);
        }
        return ranked;
    }
    fromQdrantHit(params) {
        const sourceType = this.inferQdrantSourceType(params.collection, params.metadata);
        const authorityScore = sourceType === 'qdrant'
            ? legal_source_types_1.AUTHORITY_SCORES.qdrant
            : Math.max(legal_source_types_1.AUTHORITY_SCORES.qdrant, legal_source_types_1.AUTHORITY_SCORES[sourceType]);
        const normalizedCitation = this.normalizeCitation(params.metadata.citation ||
            params.metadata.neutralCitation ||
            params.metadata.caseCitation ||
            params.metadata.actName ||
            params.title);
        return {
            id: params.id,
            title: params.title,
            normalizedCitation,
            sourceType,
            tier: 1,
            authorityScore,
            confidenceScore: this.calculateConfidence(params.score, authorityScore, normalizedCitation, params.excerpt),
            relevanceScore: this.clamp(params.score),
            jurisdiction: 'India',
            url: this.asString(params.metadata.url),
            excerpt: params.excerpt,
            date: this.asString(params.metadata.date || params.metadata.year),
            court: this.asString(params.metadata.court),
            actName: this.asString(params.metadata.actName),
            section: this.asString(params.metadata.section || params.metadata.article),
            reportNumber: this.asString(params.metadata.reportNumber),
            metadata: {
                ...params.metadata,
                collection: params.collection,
            },
        };
    }
    toContextBlock(sources, limit = 5) {
        return sources
            .slice(0, limit)
            .map((source, index) => {
            const citation = source.normalizedCitation ? `\nCitation: ${source.normalizedCitation}` : '';
            const url = source.url ? `\nURL: ${source.url}` : '';
            return `[Source ${index + 1}] ${source.title}${citation}\nTier: ${source.tier}\nAuthority: ${source.authorityScore.toFixed(2)}\nConfidence: ${source.confidenceScore.toFixed(2)}${url}\nExcerpt: ${source.excerpt}`;
        })
            .join('\n\n');
    }
    async searchTier(query, tier) {
        this.logger.log(`Legal fallback tier ${tier.tier}: searching ${tier.label}`);
        const rawResults = await this.searchDuckDuckGo(query, tier.domains, 5);
        return rawResults.map((result, index) => this.toLegalSource(result, tier.sourceType, tier.tier, index));
    }
    async searchGeneralLegalSources(query) {
        this.logger.log('Legal fallback tier 6: searching general legal sources');
        const rawResults = await this.searchDuckDuckGo(query, this.generalLegalDomains, 5);
        return rawResults.map((result, index) => this.toLegalSource(result, 'general_legal_search', 6, index));
    }
    async searchDuckDuckGo(query, domains, limit) {
        const domainQuery = domains.map((domain) => `site:${domain}`).join(' OR ');
        const searchQuery = `${query} ${domainQuery}`;
        try {
            const response = await axios_1.default.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.7',
                },
                timeout: 5000,
            });
            const html = String(response.data || '');
            const results = [];
            const resultBlocks = html.split('<div class="result__body">');
            for (let i = 1; i < resultBlocks.length && results.length < limit; i++) {
                const block = resultBlocks[i];
                const aMatch = block.match(/<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
                const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
                if (!aMatch)
                    continue;
                const url = this.decodeDuckDuckGoUrl(aMatch[1]);
                if (!this.isAllowedDomain(url, domains))
                    continue;
                results.push({
                    title: this.stripHtml(aMatch[2]),
                    snippet: snippetMatch ? this.stripHtml(snippetMatch[1]) : '',
                    url,
                });
            }
            return results;
        }
        catch (error) {
            this.logger.warn(`Trusted legal search failed for "${query}": ${error.message}`);
            return [];
        }
    }
    toLegalSource(result, sourceType, tier, index) {
        const normalizedCitation = this.normalizeCitation(`${result.title} ${result.snippet}`);
        const authorityScore = legal_source_types_1.AUTHORITY_SCORES[sourceType];
        const relevanceScore = this.estimateRelevance(result);
        return {
            id: `${sourceType}-${index}-${this.hash(result.url || result.title).slice(0, 10)}`,
            title: result.title || this.titleFromUrl(result.url),
            normalizedCitation,
            sourceType,
            tier,
            authorityScore,
            confidenceScore: this.calculateConfidence(relevanceScore, authorityScore, normalizedCitation, result.snippet),
            relevanceScore,
            jurisdiction: 'India',
            url: result.url,
            excerpt: result.snippet || result.title,
            court: sourceType === 'supreme_court' ? 'Supreme Court of India' : undefined,
            actName: sourceType === 'india_code' ? this.extractActName(`${result.title} ${result.snippet}`) : undefined,
            section: this.extractSection(`${result.title} ${result.snippet}`),
            reportNumber: sourceType === 'law_commission'
                ? this.extractLawCommissionReport(`${result.title} ${result.snippet}`)
                : undefined,
            metadata: {
                discoveredBy: 'legal-search-fallback',
                host: this.safeHost(result.url),
            },
        };
    }
    rankAndDedupe(sources) {
        const deduped = new Map();
        for (const source of sources) {
            const key = this.dedupeKey(source);
            const existing = deduped.get(key);
            if (!existing ||
                source.authorityScore > existing.authorityScore ||
                (source.authorityScore === existing.authorityScore && source.confidenceScore > existing.confidenceScore)) {
                deduped.set(key, source);
            }
        }
        return [...deduped.values()]
            .sort((a, b) => {
            if (a.tier !== b.tier)
                return a.tier - b.tier;
            if (b.authorityScore !== a.authorityScore)
                return b.authorityScore - a.authorityScore;
            return b.confidenceScore - a.confidenceScore;
        })
            .slice(0, 8);
    }
    calculateConfidence(relevanceScore, authorityScore, normalizedCitation, excerpt) {
        const citationQualityScore = normalizedCitation ? 1 : 0.35;
        const specificityScore = /\b(article|section|report|appeal|petition|scc|air|insc|act|rules?)\b/i.test(excerpt || '')
            ? 0.85
            : 0.45;
        return this.clamp(this.clamp(relevanceScore) * 0.45 +
            authorityScore * 0.4 +
            citationQualityScore * 0.1 +
            specificityScore * 0.05);
    }
    estimateRelevance(result) {
        const text = `${result.title} ${result.snippet}`.toLowerCase();
        let score = 0.55;
        if (/\b(supreme court|article|section|act|law commission|report|judgment|judgement|constitution)\b/.test(text)) {
            score += 0.2;
        }
        if (/\b(air|scc|insc|scr|w\.?p\.?|civil appeal|criminal appeal)\b/i.test(text)) {
            score += 0.15;
        }
        if ((result.snippet || '').length > 80) {
            score += 0.1;
        }
        return this.clamp(score);
    }
    inferQdrantSourceType(collection, metadata) {
        const combined = `${collection} ${metadata.source || ''} ${metadata.court || ''} ${metadata.url || ''}`.toLowerCase();
        if (combined.includes('supreme') || combined.includes('sci.gov.in'))
            return 'supreme_court';
        if (combined.includes('bare_acts') || combined.includes('india code') || combined.includes('indiacode'))
            return 'india_code';
        if (combined.includes('law commission'))
            return 'law_commission';
        if (combined.includes('gov.in') || combined.includes('nic.in'))
            return 'government_repository';
        return 'qdrant';
    }
    normalizeCitation(value) {
        const text = this.stripHtml(String(value || '')).replace(/\s+/g, ' ').trim();
        if (!text)
            return null;
        const patterns = [
            /\bAIR\s+\d{4}\s+SC\s+\d+\b/i,
            /\(\d{4}\)\s+\d+\s+SCC\s+\d+/i,
            /\b\d{4}\s+INSC\s+\d+\b/i,
            /\b(?:Civil|Criminal)\s+Appeal\s+No\.?\s+[\w/-]+(?:\s+of\s+\d{4})?/i,
            /\bW\.?P\.?\s*\(?[A-Z]?\)?\s+No\.?\s+[\w/-]+(?:\s+of\s+\d{4})?/i,
            /\bSection\s+\d+[A-Z]?(?:\([^)]+\))?,?\s+[^.]{0,80}Act,?\s+\d{4}\b/i,
            /\bArticle\s+\d+[A-Z]?\b/i,
            /\bLaw\s+Commission\s+(?:of\s+India\s+)?Report\s+No\.?\s+\d+\b/i,
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match)
                return this.canonicalizeCitation(match[0]);
        }
        const caseName = text.match(/\b[A-Z][A-Za-z.&'\s-]{2,80}\s+v\.?s?\.?\s+[A-Z][A-Za-z.&'\s-]{2,80}\b/);
        return caseName ? this.canonicalizeCitation(caseName[0]) : null;
    }
    canonicalizeCitation(citation) {
        return citation
            .replace(/\bvs\.?\b/i, 'v.')
            .replace(/\bv\b/i, 'v.')
            .replace(/\s+/g, ' ')
            .replace(/\s+,/g, ',')
            .trim();
    }
    dedupeKey(source) {
        if (source.normalizedCitation)
            return `citation:${source.normalizedCitation.toLowerCase()}`;
        if (source.url)
            return `url:${this.canonicalUrl(source.url)}`;
        return `title:${source.sourceType}:${source.title.toLowerCase()}:${this.hash(source.excerpt).slice(0, 10)}`;
    }
    decodeDuckDuckGoUrl(url) {
        if (url.includes('uddg=')) {
            const encodedUrl = url.split('uddg=')[1].split('&')[0];
            try {
                return decodeURIComponent(encodedUrl);
            }
            catch {
                return url;
            }
        }
        return url;
    }
    isAllowedDomain(url, domains) {
        const host = this.safeHost(url);
        return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    }
    safeHost(url) {
        try {
            return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
        }
        catch {
            return '';
        }
    }
    canonicalUrl(url) {
        try {
            const parsed = new URL(url);
            parsed.hash = '';
            parsed.search = '';
            return parsed.toString().replace(/\/$/, '').toLowerCase();
        }
        catch {
            return url.toLowerCase();
        }
    }
    titleFromUrl(url) {
        const host = this.safeHost(url);
        return host || 'Legal Source';
    }
    extractActName(text) {
        return this.asString(text.match(/\b([A-Z][A-Za-z\s]+Act),?\s+\d{4}\b/)?.[0]);
    }
    extractSection(text) {
        return this.asString(text.match(/\b(?:Section|Article)\s+\d+[A-Z]?(?:\([^)]+\))?/i)?.[0]);
    }
    extractLawCommissionReport(text) {
        return this.asString(text.match(/\bReport\s+No\.?\s+\d+\b/i)?.[0]);
    }
    stripHtml(value) {
        return value
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    asString(value) {
        if (value === null || value === undefined)
            return undefined;
        const text = String(value).trim();
        return text || undefined;
    }
    hash(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = (hash << 5) - hash + value.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(16);
    }
    clamp(value) {
        return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    }
};
exports.LegalSearchFallbackService = LegalSearchFallbackService;
exports.LegalSearchFallbackService = LegalSearchFallbackService = LegalSearchFallbackService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [semantic_cache_service_1.SemanticCacheService])
], LegalSearchFallbackService);
//# sourceMappingURL=legal-search-fallback.service.js.map