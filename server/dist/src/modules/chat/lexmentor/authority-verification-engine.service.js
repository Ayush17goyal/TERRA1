"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorityVerificationEngine = void 0;
const common_1 = require("@nestjs/common");
let AuthorityVerificationEngine = class AuthorityVerificationEngine {
    verify(authorities, citations, answer = '') {
        if (!authorities.length) {
            return {
                available: false,
                professionalSummary: 'No authoritative sources were retrieved for this query. Verification is not possible.',
            };
        }
        const top = authorities[0];
        const authoritative = authorities.filter((a) => a.authorityStrength >= 0.78);
        const retrievedKeys = new Set(citations
            .filter((c) => c.support === 'retrieved')
            .map((c) => c.citation.toLowerCase()));
        const generated = citations.filter((c) => c.support === 'generated');
        const supportedGenerated = generated.filter((c) => retrievedKeys.has(c.citation.toLowerCase())).length;
        const citationAccuracy = generated.length > 0
            ? Math.round((supportedGenerated / generated.length) * 100)
            : Math.round(Math.min(100, (citations.filter((c) => c.support === 'retrieved').length /
                Math.max(1, authorities.length)) *
                100));
        const answerCitations = this.extractCitationStrings(answer);
        const unsupported = answerCitations.filter((c) => !retrievedKeys.has(c.toLowerCase()));
        const corpusText = authorities
            .map((a) => `${a.title} ${a.citation ?? ''} ${a.chunkText}`)
            .join('\n')
            .toLowerCase();
        const amendmentHits = this.findSignals(corpusText, [
            'amendment',
            'amended',
            'substituted',
            'repealed',
            'omitted',
            'with effect from',
            'inserted by',
        ]);
        const conflictHits = this.findSignals(corpusText, [
            'contrary view',
            'distinguished',
            'overruled',
            'doubted',
            'referred to larger bench',
            'per incuriam',
        ]);
        const invalidHits = this.findSignals(corpusText, [
            'overruled',
            'repealed',
            'struck down',
            'unconstitutional',
            'no longer good law',
        ]);
        const avgRetrieval = this.avg(authorities.map((a) => a.retrievalScore));
        const avgRerank = this.avg(authorities.map((a) => a.rerankerScore));
        const avgAuthority = this.avg(authorities.map((a) => a.authorityStrength));
        const citationCoverage = citations.length
            ? citations.filter((c) => c.support === 'retrieved').length / citations.length
            : 0.45;
        const hallucinationPenalty = Math.min(0.22, unsupported.length * 0.055);
        const confidenceScore = Math.round(this.clamp(avgRetrieval * 0.28 +
            citationCoverage * 0.22 +
            avgAuthority * 0.22 +
            avgRerank * 0.20 +
            (1 - hallucinationPenalty) * 0.08) * 100);
        const riskLevel = confidenceScore >= 78 && !invalidHits.length && unsupported.length === 0
            ? 'Low'
            : confidenceScore >= 55 && !invalidHits.length
                ? 'Medium'
                : 'High';
        const goodLawStatus = invalidHits.length
            ? 'Questionable — adverse signals found in retrieved material'
            : authoritative.length
                ? 'Supported by authoritative retrieved sources'
                : 'Supported by persuasive or secondary material only';
        const bindingAuthority = this.computeBindingAuthority(authorities);
        const now = new Date().toISOString();
        return {
            available: true,
            authorityStatus: riskLevel === 'Low' ? 'Verified' : riskLevel === 'Medium' ? 'Needs Review' : 'Uncertain',
            goodLawStatus,
            recentAmendments: amendmentHits.length
                ? `${amendmentHits.length} amendment signal(s) detected in retrieved material`
                : 'None detected in retrieved material',
            conflictingJudgments: conflictHits.length
                ? `${conflictHits.length} conflict signal(s) detected`
                : 'None detected in retrieved material',
            bindingAuthority,
            bindingCourt: bindingAuthority,
            citationAccuracy,
            confidenceScore,
            riskLevel,
            lastVerified: now,
            verificationTimestamp: now,
            primarySources: authorities.slice(0, 6).map((a) => a.title),
            citationValidation: citations.map((c) => ({
                citation: c.citation,
                status: c.support === 'retrieved'
                    ? 'Grounded in retrieved source'
                    : retrievedKeys.has(c.citation.toLowerCase())
                        ? 'Cross-matched to retrieved material'
                        : 'Generated — not independently supported by retrieval',
                paragraphSupport: c.excerpt ? 'Retrieved excerpt available' : 'No excerpt',
            })),
            unsupportedReasoning: unsupported.map((c) => `Not found in retrieved authorities: ${c}`),
            professionalSummary: `Confidence ${confidenceScore}% from ${authorities.length} retrieved chunk(s). ` +
                `${invalidHits.length ? 'Adverse status signals detected — independent verification recommended. ' : ''}` +
                `Risk level: ${riskLevel}.`,
            details: {
                reason: `Top source: ${top.title}. Retrieval avg ${avgRetrieval.toFixed(2)}, reranker avg ${avgRerank.toFixed(2)}, authority avg ${avgAuthority.toFixed(2)}.`,
                latestAuthority: this.latestSource(authorities),
                relevantAmendment: amendmentHits.length ? amendmentHits.join('; ') : undefined,
                conflictingJudgment: conflictHits.length ? conflictHits.join('; ') : undefined,
                suggestedAuthority: top.citation || top.title,
            },
            sources: authorities.slice(0, 8).map((a) => ({
                name: a.citation || a.title,
                type: a.collection,
                authorityLevel: this.authorityLabel(a),
                date: a.date,
                status: invalidHits.some((s) => `${a.title} ${a.chunkText}`.toLowerCase().includes(s))
                    ? 'Adverse status signal in source text'
                    : 'Retrieved as supporting evidence',
                isValid: !invalidHits.some((s) => `${a.title} ${a.chunkText}`.toLowerCase().includes(s)),
            })),
            evidence: {
                retrievalScore: avgRetrieval,
                rerankerScore: avgRerank,
                authorityStrength: avgAuthority,
                citationCoverage,
                hallucinationPenalty,
                sourceCount: authorities.length,
            },
        };
    }
    computeBindingAuthority(authorities) {
        if (authorities.some((a) => a.collection === 'Constitution'))
            return 'Constitutional text — highest authority';
        const sc = authorities.find((a) => a.collection === 'Supreme Court Judgments');
        if (sc)
            return sc.benchStrength
                ? `Supreme Court of India (${sc.benchStrength}-judge bench)`
                : 'Supreme Court of India';
        if (authorities.some((a) => a.collection === 'Bare Acts'))
            return 'Statutory text (Central/State legislature)';
        if (authorities.some((a) => a.collection === 'High Court Judgments'))
            return 'High Court (binding in jurisdiction)';
        return 'Persuasive or secondary material';
    }
    latestSource(authorities) {
        const dated = authorities
            .filter((a) => a.date)
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const top = dated[0] ?? authorities[0];
        return top?.citation ?? top?.title;
    }
    authorityLabel(a) {
        if (a.collection === 'Constitution')
            return 'Constitutional Authority';
        if (a.collection === 'Supreme Court Judgments')
            return a.benchStrength
                ? `Supreme Court (${a.benchStrength}-judge bench)`
                : 'Supreme Court';
        if (a.collection === 'Bare Acts')
            return 'Statutory Text';
        if (a.collection === 'High Court Judgments')
            return 'High Court';
        if (a.collection === 'Law Commission Reports')
            return 'Law Commission';
        return 'Persuasive Source';
    }
    extractCitationStrings(text) {
        const matches = text.match(/\b(?:Article|Section)\s+\d+[A-Z]?(?:\([^)]+\))?|\b[A-Z][A-Za-z. &-]{2,70}\s+v\.?\s+[A-Z][A-Za-z. &-]{2,70}/g) ?? [];
        return [...new Set(matches.map((m) => m.trim()))];
    }
    findSignals(text, signals) {
        return signals.filter((s) => text.includes(s));
    }
    avg(values) {
        return values.length
            ? values.reduce((sum, v) => sum + v, 0) / values.length
            : 0;
    }
    clamp(v) {
        return Math.max(0, Math.min(1, v));
    }
};
exports.AuthorityVerificationEngine = AuthorityVerificationEngine;
exports.AuthorityVerificationEngine = AuthorityVerificationEngine = __decorate([
    (0, common_1.Injectable)()
], AuthorityVerificationEngine);
//# sourceMappingURL=authority-verification-engine.service.js.map