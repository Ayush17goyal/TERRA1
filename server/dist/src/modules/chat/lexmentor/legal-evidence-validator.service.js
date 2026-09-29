"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalEvidenceValidator = void 0;
const common_1 = require("@nestjs/common");
const legal_answer_generation_config_1 = require("./legal-answer-generation.config");
let LegalEvidenceValidator = class LegalEvidenceValidator {
    validate(input) {
        const authorities = input.context.authorities;
        const bestSimilarity = Math.max(0, ...authorities.map((authority) => authority.retrievalScore ?? 0));
        const hasRelevantLegalEvidence = authorities.length > 0 && input.context.hasAuthoritativeSources;
        const sourceAuthoritative = authorities.some((authority) => authority.authorityStrength >= 0.55);
        const sectionOrArticleExists = this.sectionOrArticleExists(input.query, authorities);
        const retrievedTextMatchesQuestion = this.retrievedTextMatchesQuestion(input.query, authorities, bestSimilarity);
        const hasConflictingSources = this.hasConflictingSources(authorities);
        const score = this.confidenceScore({
            retrievalConfidence: input.retrievalConfidence,
            bestSimilarity,
            hasRelevantLegalEvidence,
            sectionOrArticleExists,
            retrievedTextMatchesQuestion,
            sourceAuthoritative,
            hasConflictingSources,
        });
        const confidence = score >= legal_answer_generation_config_1.LEGAL_ANSWER_VALIDATION_CONFIG.minConfidenceForDefinitiveAnswer
            ? 'high'
            : score >= legal_answer_generation_config_1.LEGAL_ANSWER_VALIDATION_CONFIG.mediumConfidenceFloor
                ? 'medium'
                : 'low';
        const canGenerateDefinitiveAnswer = confidence !== 'low' &&
            hasRelevantLegalEvidence &&
            sectionOrArticleExists &&
            retrievedTextMatchesQuestion &&
            sourceAuthoritative &&
            !hasConflictingSources &&
            bestSimilarity >= legal_answer_generation_config_1.LEGAL_ANSWER_VALIDATION_CONFIG.minSimilarityScore;
        return {
            confidence,
            confidenceScore: score,
            canGenerateDefinitiveAnswer,
            hasRelevantLegalEvidence,
            sectionOrArticleExists,
            retrievedTextMatchesQuestion,
            sourceAuthoritative,
            hasConflictingSources,
            reason: this.reason({
                hasRelevantLegalEvidence,
                sectionOrArticleExists,
                retrievedTextMatchesQuestion,
                sourceAuthoritative,
                hasConflictingSources,
                bestSimilarity,
            }),
            userMessage: canGenerateDefinitiveAnswer ? undefined : this.failureMessage(hasConflictingSources),
        };
    }
    sectionOrArticleExists(query, authorities) {
        const references = this.extractRequestedReferences(query);
        if (!references.length)
            return true;
        return references.every((reference) => authorities.some((authority) => this.authorityContainsReference(authority, reference)));
    }
    retrievedTextMatchesQuestion(query, authorities, bestSimilarity) {
        if (!authorities.length)
            return false;
        if (bestSimilarity >= legal_answer_generation_config_1.LEGAL_ANSWER_VALIDATION_CONFIG.minSimilarityScore)
            return true;
        const queryTerms = this.significantTerms(query);
        if (!queryTerms.length)
            return bestSimilarity >= legal_answer_generation_config_1.LEGAL_ANSWER_VALIDATION_CONFIG.mediumConfidenceFloor;
        const evidenceText = authorities
            .slice(0, 5)
            .map((authority) => `${authority.title} ${authority.citation ?? ''} ${authority.chunkText}`)
            .join(' ')
            .toLowerCase();
        const matched = queryTerms.filter((term) => evidenceText.includes(term)).length;
        return matched / queryTerms.length >= 0.6;
    }
    hasConflictingSources(authorities) {
        const text = authorities.map((authority) => `${authority.title} ${authority.chunkText}`).join('\n').toLowerCase();
        return [
            'contrary view',
            'conflicting',
            'conflict between',
            'overruled',
            'repealed',
            'struck down',
            'no longer good law',
            'per incuriam',
            'referred to larger bench',
        ].some((signal) => text.includes(signal));
    }
    confidenceScore(input) {
        let score = input.retrievalConfidence * 0.35 +
            input.bestSimilarity * 0.25 +
            (input.hasRelevantLegalEvidence ? 0.15 : 0) +
            (input.sectionOrArticleExists ? 0.1 : 0) +
            (input.retrievedTextMatchesQuestion ? 0.1 : 0) +
            (input.sourceAuthoritative ? 0.05 : 0);
        if (input.hasConflictingSources)
            score -= 0.3;
        return Math.max(0, Math.min(1, Number(score.toFixed(2))));
    }
    reason(input) {
        if (!input.hasRelevantLegalEvidence)
            return 'No legal documents were retrieved.';
        if (input.bestSimilarity < legal_answer_generation_config_1.LEGAL_ANSWER_VALIDATION_CONFIG.minSimilarityScore)
            return 'Top retrieval similarity is below the legal reliability threshold.';
        if (!input.sectionOrArticleExists)
            return 'Requested Section or Article was not verified in the retrieved legal text.';
        if (!input.retrievedTextMatchesQuestion)
            return 'Retrieved text does not sufficiently match the legal question.';
        if (!input.sourceAuthoritative)
            return 'Retrieved material is not authoritative enough for a definitive legal answer.';
        if (input.hasConflictingSources)
            return 'Conflicting or adverse legal-source signals were found in retrieved material.';
        return 'Retrieved legal evidence supports a grounded answer.';
    }
    failureMessage(hasConflictingSources) {
        if (hasConflictingSources) {
            return `${legal_answer_generation_config_1.LEGAL_VERIFICATION_FAILURE_MESSAGE} The retrieved sources contain conflict or adverse-status signals, so I cannot give a definitive answer without clarification or further authoritative material.`;
        }
        return legal_answer_generation_config_1.LEGAL_VERIFICATION_FAILURE_MESSAGE;
    }
    extractRequestedReferences(query) {
        const references = [];
        const pattern = /\b(section|sec\.?|article|art\.?)\s+(\d+[a-z]?(?:\s*\([^)]+\))?)/gi;
        let match;
        while ((match = pattern.exec(query)) !== null) {
            const rawType = match[1].toLowerCase();
            references.push({
                type: rawType.startsWith('art') ? 'article' : 'section',
                number: this.normalizeReferenceNumber(match[2]),
            });
        }
        return references;
    }
    authorityContainsReference(authority, reference) {
        const metadataValue = reference.type === 'article' ? authority.article : authority.section;
        if (metadataValue && this.normalizeReferenceNumber(metadataValue) === reference.number)
            return true;
        const label = reference.type === 'article' ? 'article' : 'section';
        const escapedNumber = reference.number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\s\*/g, '\\s*');
        const referencePattern = new RegExp(`\\b${label}\\s+${escapedNumber}\\b`, 'i');
        return referencePattern.test(`${authority.title} ${authority.citation ?? ''} ${authority.chunkText}`);
    }
    normalizeReferenceNumber(value) {
        return value.toLowerCase().replace(/\s+/g, '').trim();
    }
    significantTerms(query) {
        const stopWords = new Set([
            'what',
            'which',
            'where',
            'when',
            'why',
            'how',
            'the',
            'and',
            'or',
            'for',
            'from',
            'about',
            'explain',
            'section',
            'article',
            'act',
            'law',
            'legal',
            'does',
            'mean',
        ]);
        return Array.from(new Set(query
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((term) => term.length >= 4 && !stopWords.has(term) && !/^\d+$/.test(term)))).slice(0, 12);
    }
};
exports.LegalEvidenceValidator = LegalEvidenceValidator;
exports.LegalEvidenceValidator = LegalEvidenceValidator = __decorate([
    (0, common_1.Injectable)()
], LegalEvidenceValidator);
//# sourceMappingURL=legal-evidence-validator.service.js.map