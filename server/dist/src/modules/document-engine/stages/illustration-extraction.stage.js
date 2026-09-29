"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IllustrationExtractionStage = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const STATUTORY_ILLUSTRATION_REGEX = /Illustration[s]?\s*[:.\-]?\s*([^.]{10,500}\.)/gi;
const HYPOTHETICAL_REGEX = /\b(?:for example|for instance|suppose|consider the case where|say)\b[,:]?\s*([^.]{10,500}\.)/gi;
let IllustrationExtractionStage = class IllustrationExtractionStage {
    extract(section, definitionsInSection, constructsInSection) {
        const results = [];
        const nearestDefinitionId = definitionsInSection[0]?.id ?? null;
        const nearestConstructSectionId = constructsInSection[0]?.sectionId ?? null;
        for (const match of section.text.matchAll(STATUTORY_ILLUSTRATION_REGEX)) {
            results.push({
                id: crypto.randomUUID(),
                sectionId: section.id,
                text: match[1].trim(),
                illustrationType: 'statutory',
                linkedDefinitionId: nearestDefinitionId,
                linkedConstructSectionId: nearestConstructSectionId,
            });
        }
        for (const match of section.text.matchAll(HYPOTHETICAL_REGEX)) {
            results.push({
                id: crypto.randomUUID(),
                sectionId: section.id,
                text: match[1].trim(),
                illustrationType: 'instructional_hypothetical',
                linkedDefinitionId: nearestDefinitionId,
                linkedConstructSectionId: nearestConstructSectionId,
            });
        }
        return results;
    }
};
exports.IllustrationExtractionStage = IllustrationExtractionStage;
exports.IllustrationExtractionStage = IllustrationExtractionStage = __decorate([
    (0, common_1.Injectable)()
], IllustrationExtractionStage);
//# sourceMappingURL=illustration-extraction.stage.js.map