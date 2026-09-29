"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var Reranker_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reranker = void 0;
const common_1 = require("@nestjs/common");
const CURRENT_YEAR = new Date().getFullYear();
const COLLECTION_INTENT_ALIGNMENT = {
    'Constitution': { 'Constitutional Law': 1.0, 'Research': 0.8, 'Moot Court': 0.8, 'Concept': 0.6 },
    'Bare Acts': { 'Bare Act': 1.0, 'Contract': 0.8, 'Concept': 0.7, 'Drafting': 0.7, 'General': 0.5 },
    'Supreme Court Judgments': { 'Case Law': 1.0, 'Constitutional Law': 0.9, 'Research': 0.8, 'Moot Court': 0.9, 'General': 0.6 },
    'High Court Judgments': { 'Case Law': 0.8, 'Research': 0.7, 'Moot Court': 0.6, 'General': 0.5 },
    'Law Commission Reports': { 'Research': 1.0, 'Bare Act': 0.7, 'Concept': 0.6, 'General': 0.5 },
    'Research Papers': { 'Research': 0.9, 'Moot Court': 0.7, 'Concept': 0.6, 'General': 0.4 },
    'User Uploaded Documents': { General: 1.0, Drafting: 1.0, Contract: 0.9, Research: 0.9, 'Bare Act': 0.8 },
};
const USER_DOC_BOOST = 0.18;
const MAX_RERANKED = 12;
const MIN_RERANKER_SCORE = 0.28;
let Reranker = Reranker_1 = class Reranker {
    constructor() {
        this.logger = new common_1.Logger(Reranker_1.name);
    }
    rerank(intent, authorities) {
        if (!authorities.length)
            return [];
        const scored = authorities.map((authority) => {
            const retrievalComponent = this.clamp(authority.retrievalScore) * 0.45;
            const authorityComponent = authority.authorityStrength * 0.25;
            const intentComponent = this.intentAlignmentScore(intent, authority) * 0.20;
            const recencyComponent = this.recencyScore(authority.date) * 0.10;
            const rerankerScore = this.clamp(retrievalComponent + authorityComponent + intentComponent + recencyComponent +
                (authority.collection === 'User Uploaded Documents' ? USER_DOC_BOOST : 0));
            return { ...authority, rerankerScore };
        });
        const reranked = scored
            .filter((a) => a.rerankerScore >= MIN_RERANKER_SCORE)
            .sort((a, b) => b.rerankerScore - a.rerankerScore)
            .slice(0, MAX_RERANKED);
        this.logger.debug(`Reranker: ${authorities.length} → ${reranked.length} chunks (intent=${intent}, ` +
            `top score=${reranked[0]?.rerankerScore.toFixed(3) ?? 'n/a'})`);
        return reranked;
    }
    intentAlignmentScore(intent, authority) {
        const alignmentMap = COLLECTION_INTENT_ALIGNMENT[authority.collection];
        if (!alignmentMap)
            return 0.4;
        return alignmentMap[intent] ?? alignmentMap['General'] ?? 0.4;
    }
    recencyScore(date) {
        if (!date)
            return 0.5;
        const year = this.extractYear(date);
        if (!year)
            return 0.5;
        const age = Math.max(0, CURRENT_YEAR - year);
        return Math.max(0, 1 - age / 30);
    }
    extractYear(date) {
        const m = date.match(/\b(19|20)\d{2}\b/);
        if (!m)
            return null;
        const year = Number(m[0]);
        return year >= 1900 && year <= CURRENT_YEAR ? year : null;
    }
    clamp(value) {
        return Math.max(0, Math.min(1, value));
    }
};
exports.Reranker = Reranker;
exports.Reranker = Reranker = Reranker_1 = __decorate([
    (0, common_1.Injectable)()
], Reranker);
//# sourceMappingURL=reranker.service.js.map