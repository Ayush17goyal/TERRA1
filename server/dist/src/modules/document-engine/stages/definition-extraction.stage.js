"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefinitionExtractionStage = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const STATUTORY_DEFINITION_REGEX = /["“]([^"”]{2,60})["”]\s+(means|includes|shall mean|shall include)\s+([^.]{5,600})\./gi;
const DESCRIPTIVE_DEFINITION_REGEX = /\b([A-Z][A-Za-z\s]{2,40})\s+(?:is|refers to|can be defined as)\s+([^.]{10,400})\./g;
let DefinitionExtractionStage = class DefinitionExtractionStage {
    extract(section, documentType) {
        const results = [];
        for (const match of section.text.matchAll(STATUTORY_DEFINITION_REGEX)) {
            results.push({
                id: crypto.randomUUID(),
                sectionId: section.id,
                term: match[1].trim(),
                definitionText: match[3].trim(),
                definitionType: 'statutory',
                scope: /definitions?|interpretation/i.test(section.hierarchyPath) ? 'document_wide' : 'local',
            });
        }
        if (documentType === 'notes' || documentType === 'textbook') {
            for (const match of section.text.matchAll(DESCRIPTIVE_DEFINITION_REGEX)) {
                const term = match[1].trim();
                if (term.split(' ').length > 6)
                    continue;
                results.push({
                    id: crypto.randomUUID(),
                    sectionId: section.id,
                    term,
                    definitionText: match[2].trim(),
                    definitionType: 'descriptive',
                    scope: 'local',
                });
            }
        }
        return results;
    }
};
exports.DefinitionExtractionStage = DefinitionExtractionStage;
exports.DefinitionExtractionStage = DefinitionExtractionStage = __decorate([
    (0, common_1.Injectable)()
], DefinitionExtractionStage);
//# sourceMappingURL=definition-extraction.stage.js.map