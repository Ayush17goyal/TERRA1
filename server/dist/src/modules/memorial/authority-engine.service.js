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
var AuthorityEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorityEngineService = void 0;
const common_1 = require("@nestjs/common");
const vector_search_service_1 = require("../retrieval/vector-search.service");
const memorial_ai_service_1 = require("./memorial-ai.service");
const memorial_prompts_1 = require("./memorial-prompts");
const memorial_authority_catalog_1 = require("./memorial-authority-catalog");
let AuthorityEngineService = AuthorityEngineService_1 = class AuthorityEngineService {
    constructor(ai, vectorSearch) {
        this.ai = ai;
        this.vectorSearch = vectorSearch;
        this.logger = new common_1.Logger(AuthorityEngineService_1.name);
    }
    async generate(issues, blueprint, options) {
        const candidates = await this.buildCandidates(issues, blueprint, options);
        try {
            const response = await this.ai.json({
                system: memorial_prompts_1.MEMORIAL_SYSTEM,
                prompt: (0, memorial_prompts_1.authorityPrompt)(JSON.stringify(issues.map((i) => ({ id: i.id, issue: i.issue, subIssues: i.subIssues, legalTests: i.legalTests, legalAnchors: i.legalAnchors, authorityQueries: i.authorityQueries }))), JSON.stringify(candidates.map((c) => ({ candidateId: c.candidateId, type: c.type, citation: c.citation, proposition: c.proposition, ratioOrRule: c.ratioOrRule, defaultSide: c.defaultSide, verified: c.verified, confidence: c.confidence, keywords: c.keywords })))),
                options,
                maxTokens: 5000,
                stage: 'authority-ranking',
            });
            const authorities = this.normalizeRankings(response?.rankings, issues, candidates, options);
            if (authorities.length < issues.length * 4)
                throw new Error('Authority ranking returned insufficient issue coverage.');
            return { authorities, usedAi: true };
        }
        catch (error) {
            this.logger.warn(`Authority ranking fallback used: ${error?.message || error}`);
            return {
                authorities: this.deterministicRank(issues, candidates, options),
                usedAi: false,
                warning: `AI authority ranking unavailable; deterministic verified-authority ranking used: ${error?.message || error}`,
            };
        }
    }
    async buildCandidates(issues, blueprint, options) {
        const candidates = memorial_authority_catalog_1.MEMORIAL_AUTHORITY_CATALOG.map((item) => ({ ...item, candidateId: item.catalogId }));
        blueprint.lawsMentioned.forEach((law, index) => {
            if (!this.isValidAuthorityCitation(law.citation) || this.isDuplicateCitation(candidates, law.citation))
                return;
            candidates.push({
                catalogId: `UP_${index + 1}`,
                candidateId: `UP_${index + 1}`,
                type: /article/i.test(law.citation) ? 'constitution' : /section|act|code|rules/i.test(law.citation) ? 'statute' : 'report',
                citation: law.citation,
                proposition: law.context || `Provision expressly mentioned in the proposition: ${law.citation}`,
                ratioOrRule: law.context || `The scope and elements of ${law.citation} must be applied to the proposition facts.`,
                defaultSide: 'both',
                risk: 'Provision extracted from the uploaded proposition; verify the official text before final filing.',
                confidence: 82,
                verified: true,
                verificationSource: 'uploaded',
                keywords: this.tokens(`${law.citation} ${law.context}`),
            });
        });
        const retrieved = await this.retrieveCandidates(issues, options);
        retrieved.forEach((candidate) => {
            if (!this.isDuplicateCitation(candidates, candidate.citation))
                candidates.push(candidate);
        });
        return candidates;
    }
    async retrieveCandidates(issues, options) {
        const sourceNames = options.selectedSources?.length ? options.selectedSources : ['judgments', 'acts', 'law_commission_reports'];
        const collections = sourceNames.map((source) => this.toCollection(source)).filter(Boolean);
        const retrieved = [];
        for (const issue of issues) {
            for (const collection of collections) {
                try {
                    const query = [issue.issue, ...issue.authorityQueries].join(' ');
                    const hits = await this.vectorSearch.search(collection, query, 4);
                    hits.forEach((hit, index) => {
                        const metadata = hit.metadata || {};
                        const citation = String(metadata.citation || metadata.case_name || metadata.title || '').trim();
                        if (!this.isValidAuthorityCitation(citation))
                            return;
                        const text = String(hit.text || metadata.text || '').replace(/\s+/g, ' ').trim();
                        retrieved.push({
                            catalogId: `RET_${issue.id}_${collection}_${index}`,
                            candidateId: `RET_${issue.id}_${collection}_${index}`,
                            type: collection === 'acts' ? 'statute' : collection === 'judgments' ? 'case' : collection === 'law_commission_reports' ? 'report' : 'article',
                            citation,
                            proposition: text.slice(0, 700),
                            ratioOrRule: text.slice(0, 900),
                            defaultSide: 'both',
                            risk: 'Retrieved from the configured local legal corpus; verify the official text and pinpoint before filing.',
                            confidence: Math.round(Math.max(60, Math.min(96, Number(hit.score || 0.7) * 100))),
                            verified: true,
                            verificationSource: 'retrieval',
                            court: metadata.court,
                            year: metadata.year ? String(metadata.year) : undefined,
                            pinpoint: metadata.pinpoint || metadata.paragraph,
                            sourceUrl: metadata.url,
                            keywords: this.tokens(`${citation} ${text}`),
                        });
                    });
                }
                catch (error) {
                    this.logger.debug(`Retrieval unavailable for ${collection}: ${error?.message || error}`);
                }
            }
        }
        return retrieved;
    }
    normalizeRankings(rawRankings, issues, candidates, options) {
        const candidateById = new Map(candidates.map((c) => [c.candidateId, c]));
        const result = [];
        const rankings = Array.isArray(rawRankings) ? rawRankings : [];
        for (const issue of issues) {
            const ranking = rankings.find((r) => String(r.issueId) === issue.id);
            const rows = Array.isArray(ranking?.authorities) ? ranking.authorities : [];
            const eligibleIds = new Set(this.rankForIssue(issue, candidates, options).map((candidate) => candidate.candidateId));
            rows.slice(0, 12).forEach((row) => {
                const candidate = candidateById.get(String(row.candidateId));
                if (!candidate || !eligibleIds.has(candidate.candidateId))
                    return;
                if (!candidate.verified && !options.allowUnverifiedAuthorities)
                    return;
                result.push(this.toAuthority(candidate, issue.id, {
                    sideUsefulness: this.side(row.sideUsefulness, candidate.defaultSide),
                    proposition: String(row.proposition || candidate.proposition),
                    ratioOrRule: String(row.ratioOrRule || candidate.ratioOrRule),
                    relevanceReason: String(row.relevanceReason || ''),
                    confidence: Math.min(candidate.confidence, this.clamp(Number(row.confidence || candidate.confidence), 0, 100)),
                }, result.length));
            });
        }
        const covered = new Set(result.map((a) => a.issueId));
        for (const issue of issues) {
            if (covered.has(issue.id))
                continue;
            result.push(...this.rankForIssue(issue, candidates, options).slice(0, 7).map((candidate) => this.toAuthority(candidate, issue.id, {}, result.length)));
        }
        return this.dedupe(result);
    }
    deterministicRank(issues, candidates, options) {
        const result = [];
        for (const issue of issues) {
            const ranked = this.rankForIssue(issue, candidates, options).slice(0, options.depth === 'exhaustive' ? 10 : options.depth === 'standard' ? 6 : 8);
            ranked.forEach((candidate) => result.push(this.toAuthority(candidate, issue.id, { relevanceReason: `Matched to ${issue.issue}` }, result.length)));
        }
        return this.dedupe(result);
    }
    rankForIssue(issue, candidates, options) {
        const queryTokens = this.tokens([issue.issue, ...issue.subIssues, ...issue.legalTests, ...issue.legalAnchors, ...issue.authorityQueries].join(' '));
        const family = this.issueFamily(issue.issue);
        return candidates
            .filter((candidate) => (candidate.verified || options.allowUnverifiedAuthorities) && this.isValidAuthorityCitation(candidate.citation))
            .map((candidate) => {
            const overlap = this.overlap(queryTokens, candidate.keywords);
            const compatibility = this.familyCompatibility(family, candidate);
            return {
                candidate, overlap, compatibility,
                score: overlap
                    + compatibility
                    + (candidate.verified ? 2 : 0)
                    + candidate.confidence / 100,
            };
        })
            .filter((item) => item.score > 2.4 && (item.overlap > 0 || item.compatibility > 0))
            .sort((a, b) => b.score - a.score)
            .map((item) => item.candidate);
    }
    toAuthority(candidate, issueId, overrides = {}, index = 0) {
        return {
            id: `AUTH_${index + 1}`,
            type: candidate.type,
            citation: candidate.citation,
            proposition: overrides.proposition || candidate.proposition,
            ratioOrRule: overrides.ratioOrRule || candidate.ratioOrRule,
            sideUsefulness: overrides.sideUsefulness || candidate.defaultSide,
            risk: candidate.risk,
            issueId,
            confidence: overrides.confidence || candidate.confidence,
            verified: candidate.verified,
            verificationSource: candidate.verificationSource,
            court: candidate.court,
            year: candidate.year,
            pinpoint: candidate.pinpoint,
            relevanceReason: overrides.relevanceReason || '',
            sourceUrl: candidate.sourceUrl,
        };
    }
    dedupe(items) {
        const seen = new Set();
        const result = items.filter((item) => {
            const key = `${item.issueId}:${item.citation.toLowerCase().replace(/\s+/g, ' ')}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
        result.forEach((item, index) => { item.id = `AUTH_${index + 1}`; });
        return result;
    }
    isValidAuthorityCitation(citation) {
        const clean = String(citation || '').replace(/\s+/g, ' ').trim();
        if (clean.length < 8 || clean.length > 190)
            return false;
        if (/accused|complainant|alleged|matrimonial|obtained|misused|violating|personal data obtained/i.test(clean))
            return false;
        return /(?:\bv\.?\s+|\(\d{4}\)|AIR\s+\d{4}|SCC|SCR|Article\s+\d+|Section\s+\d+|Act,?\s+\d{4}|Adhiniyam,?\s+\d{4}|Sanhita,?\s+\d{4}|Constitution of [A-Z][A-Za-z]+|Treaty|Agreement|Convention|Rules?|Regulations?|Mutual Legal Assistance)/i.test(clean);
    }
    issueFamily(issue) {
        if (/(?:ELECTRONIC|DIGITAL).{0,40}EVIDENCE|SAKSHYA|FORENSIC|COMPUTER OUTPUT/i.test(issue))
            return 'evidence';
        if (/FOREIGN[- ]HOSTED|FOREIGN SERVER|SERVER|INTERMEDIAR|EXTRATERRITORIAL|SECTION 75|CROSS[- ]BORDER CYBER/i.test(issue))
            return 'jurisdiction';
        if (/SEARCH|SEIZURE|PRIVACY|ARTICLE 21|DEVICE|DATA MINIM/i.test(issue))
            return 'privacy';
        if (/\b(?:CONVICTION|SENTENCE|PUNISHMENT|PROPORTIONATE)\b/i.test(issue))
            return 'sentence';
        return 'general';
    }
    familyCompatibility(family, candidate) {
        const text = `${candidate.citation} ${candidate.proposition} ${candidate.ratioOrRule} ${candidate.keywords.join(' ')}`.toLowerCase();
        const tests = {
            evidence: /electronic|evidence|certificate|sakshya|forensic|custody|authentic|computer output|mode of proof/,
            jurisdiction: /jurisdiction|extraterritorial|territorial nexus|section 75|foreign|server|article 245|comity|legal assistance/,
            privacy: /privacy|article 21|search|seizure|surveillance|data|minimisation|proportionality|due process/,
            sentence: /article 136|appeal|conviction|sentence|punishment|proportionality|concurrent findings|special leave|proof beyond/,
            general: /$a/,
        };
        return tests[family]?.test(text) ? 3 : -3;
    }
    toCollection(source) {
        const normalized = source.toLowerCase();
        if (/judg|case|supreme|high court/.test(normalized))
            return 'judgments';
        if (/act|statute|constitution|bare/.test(normalized))
            return 'acts';
        if (/law commission|report/.test(normalized))
            return 'law_commission_reports';
        if (/paper|journal|article/.test(normalized))
            return 'research_papers';
        if (/uploaded|session|document/.test(normalized))
            return 'user_documents';
        return null;
    }
    side(value, fallback) { return ['petitioner', 'respondent', 'both'].includes(String(value)) ? String(value) : fallback; }
    isDuplicateCitation(items, citation) { const normalized = citation.toLowerCase().replace(/[^a-z0-9]+/g, ' '); return items.some((x) => x.citation.toLowerCase().replace(/[^a-z0-9]+/g, ' ') === normalized); }
    tokens(text) { return Array.from(new Set(String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 3 && !['whether', 'court', 'india', 'indica', 'under', 'with', 'that', 'this', 'from'].includes(x)))); }
    overlap(a, b) { const set = new Set(b); return a.reduce((sum, token) => sum + (set.has(token) ? 1 : 0), 0); }
    clamp(value, min, max) { return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min; }
};
exports.AuthorityEngineService = AuthorityEngineService;
exports.AuthorityEngineService = AuthorityEngineService = AuthorityEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [memorial_ai_service_1.MemorialAiService,
        vector_search_service_1.VectorSearchService])
], AuthorityEngineService);
//# sourceMappingURL=authority-engine.service.js.map