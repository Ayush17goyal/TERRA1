"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CitationExtractionStage = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const CASE_CITATION_REGEX = /\b(AIR\s+\d{4}\s+[A-Z]{2,5}\s+\d+|\(?\d{4}\)?\s+\d+\s+SCC\s+\d+|\d{4}\s+SCR\s+\d+)\b/g;
const STATUTE_CITATION_REGEX = /\b(?:Section|Article|Sec\.)\s+\d+[A-Za-z]?\s+of\s+the\s+([A-Z][A-Za-z\s,]+?(?:Act|Constitution)),?\s*(\d{4})?/g;
const CROSS_REFERENCE_REGEX = /\b(?:as\s+(?:defined|provided|stated)\s+in|under|pursuant\s+to)\s+(Section\s+\d+[A-Za-z]?|clause\s+\([a-z]\)|Article\s+\d+[A-Za-z]?)\b(?:\s+(?:above|below|of\s+this\s+(?:Act|section)))?/gi;
let CitationExtractionStage = class CitationExtractionStage {
    extract(section, casesInDocument) {
        const results = [];
        for (const match of section.text.matchAll(CASE_CITATION_REGEX)) {
            const normalized = this.normalizeCaseCitation(match[0]);
            results.push({
                id: crypto.randomUUID(),
                sectionId: section.id,
                rawText: match[0],
                citationType: 'case',
                normalizedForm: normalized,
                resolvedTargetId: this.resolveToNearbyCase(section, match.index || 0, casesInDocument),
            });
        }
        for (const match of section.text.matchAll(STATUTE_CITATION_REGEX)) {
            const actName = match[1].trim();
            const year = match[2] || '';
            results.push({
                id: crypto.randomUUID(),
                sectionId: section.id,
                rawText: match[0],
                citationType: 'statute',
                normalizedForm: `${actName}${year ? `, ${year}` : ''}`.trim(),
                resolvedTargetId: null,
            });
        }
        for (const match of section.text.matchAll(CROSS_REFERENCE_REGEX)) {
            results.push({
                id: crypto.randomUUID(),
                sectionId: section.id,
                rawText: match[0],
                citationType: 'cross_reference',
                normalizedForm: match[1].trim(),
                resolvedTargetId: null,
            });
        }
        return results;
    }
    normalizeCaseCitation(raw) {
        return raw.replace(/\s+/g, ' ').trim();
    }
    resolveToNearbyCase(section, matchIndex, cases) {
        const sameSectionCases = cases.filter((c) => c.sectionId === section.id);
        if (sameSectionCases.length === 0)
            return null;
        return sameSectionCases[sameSectionCases.length - 1].id;
    }
};
exports.CitationExtractionStage = CitationExtractionStage;
exports.CitationExtractionStage = CitationExtractionStage = __decorate([
    (0, common_1.Injectable)()
], CitationExtractionStage);
//# sourceMappingURL=citation-extraction.stage.js.map