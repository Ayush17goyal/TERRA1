"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseExtractionStage = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const CASE_NAME_REGEX = /\b([A-Z][A-Za-z.&\s]{2,80}?)\s+v\.?s?\.?\s+([A-Z][A-Za-z.&\s]{2,80}?)(?=[,.\n]|\s+\(|\s+on\s+\d)/g;
const YEAR_REGEX = /\b(1[89]\d{2}|20\d{2})\b/;
const COURT_REGEX = /\b(Supreme Court|High Court(?: of [A-Za-z]+)?)\b/i;
const STRUCTURE_SECTION_PATTERNS = {
    facts: /^\s*(?:FACTS|FACTUAL\s+BACKGROUND|BRIEF\s+FACTS|THE\s+FACTS)\s*[:.\-]?\s*/im,
    issues: /^\s*(?:ISSUES?\s+(?:FOR\s+)?(?:CONSIDERATION|DETERMINATION|FRAMED)|QUESTIONS?\s+(?:OF\s+LAW|FOR\s+CONSIDERATION))\s*[:.\-]?\s*/im,
    held: /^\s*(?:HELD|DECISION|JUDGMENT)\s*[:.\-]?\s*/im,
    ratio: /^\s*(?:RATIO\s+DECIDENDI|HOLDING|CONCLUSION|FINDINGS?)\s*[:.\-]?\s*/im,
};
let CaseExtractionStage = class CaseExtractionStage {
    extract(section, documentType) {
        const results = [];
        const matches = [...section.text.matchAll(CASE_NAME_REGEX)];
        for (const match of matches) {
            const petitioner = this.stripLeadingDiscourseWords(match[1].trim());
            const respondent = this.stripLeadingDiscourseWords(match[2].trim());
            const caseName = `${petitioner} v. ${respondent}`;
            const surroundingStart = Math.max(0, (match.index || 0) - 100);
            const surroundingEnd = Math.min(section.text.length, (match.index || 0) + 300);
            const context = section.text.slice(surroundingStart, surroundingEnd);
            const yearMatch = context.match(YEAR_REGEX);
            const courtMatch = context.match(COURT_REGEX);
            const isFullCompilation = documentType === 'case_compilation' && section.text.length > 800;
            const structured = isFullCompilation ? this.extractStructure(section.text) : null;
            results.push({
                id: crypto.randomUUID(),
                sectionId: section.id,
                caseName,
                parties: { petitioner, respondent },
                court: courtMatch ? courtMatch[0] : null,
                year: yearMatch ? yearMatch[0] : null,
                mentionType: isFullCompilation ? 'full' : 'mention',
                structured,
                context,
            });
        }
        return results;
    }
    stripLeadingDiscourseWords(name) {
        return name.replace(/^(?:In|As|See|The|Held|Ref(?:er(?:red|ence)?)?|Also|Regarding|Consider)\s+/i, '').trim();
    }
    extractStructure(text) {
        const structured = {};
        const entries = Object.entries(STRUCTURE_SECTION_PATTERNS);
        const positions = entries
            .map(([key, regex]) => ({ key, match: text.match(regex) }))
            .filter((e) => e.match)
            .map((e) => ({ key: e.key, index: e.match.index, length: e.match[0].length }))
            .sort((a, b) => a.index - b.index);
        for (let i = 0; i < positions.length; i++) {
            const current = positions[i];
            const next = positions[i + 1];
            const start = current.index + current.length;
            const end = next ? next.index : text.length;
            structured[current.key] = text.slice(start, end).trim().slice(0, 2000);
        }
        return structured;
    }
};
exports.CaseExtractionStage = CaseExtractionStage;
exports.CaseExtractionStage = CaseExtractionStage = __decorate([
    (0, common_1.Injectable)()
], CaseExtractionStage);
//# sourceMappingURL=case-extraction.stage.js.map