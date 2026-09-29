"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataAssemblyStage = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
let MetadataAssemblyStage = class MetadataAssemblyStage {
    assemble(input) {
        const { graph } = input;
        const reviewReasons = [];
        const retrievableUnits = [];
        for (const section of graph.sections) {
            retrievableUnits.push({
                id: crypto.randomUUID(),
                type: 'section',
                hierarchyPath: section.hierarchyPath,
                text: section.text,
                refId: section.id,
            });
            if (section.needsReview)
                reviewReasons.push(`low_confidence_section:${section.id}`);
        }
        for (const definition of graph.definitions) {
            const section = graph.sections.find((s) => s.id === definition.sectionId);
            retrievableUnits.push({
                id: crypto.randomUUID(),
                type: 'definition',
                hierarchyPath: section?.hierarchyPath || '(unknown)',
                text: `"${definition.term}" ${definition.definitionType === 'statutory' ? 'means' : '—'} ${definition.definitionText}`,
                refId: definition.id,
            });
        }
        for (const caseEntry of graph.cases) {
            const section = graph.sections.find((s) => s.id === caseEntry.sectionId);
            retrievableUnits.push({
                id: crypto.randomUUID(),
                type: 'case',
                hierarchyPath: section?.hierarchyPath || '(unknown)',
                text: [caseEntry.caseName, caseEntry.structured?.held, caseEntry.structured?.ratio].filter(Boolean).join(' — '),
                refId: caseEntry.id,
            });
        }
        for (const illustration of graph.illustrations) {
            const section = graph.sections.find((s) => s.id === illustration.sectionId);
            retrievableUnits.push({
                id: crypto.randomUUID(),
                type: 'illustration',
                hierarchyPath: section?.hierarchyPath || '(unknown)',
                text: illustration.text,
                refId: illustration.id,
            });
        }
        const sectionConfidences = graph.sections.map((s) => s.confidence);
        const avgSectionConfidence = sectionConfidences.length
            ? sectionConfidences.reduce((a, b) => a + b, 0) / sectionConfidences.length
            : 0;
        const confidenceScore = Math.min(1, avgSectionConfidence * 0.6 + input.documentTypeConfidence * 0.4);
        if (input.documentTypeConfidence < 0.3)
            reviewReasons.push('low_confidence_document_type_classification');
        if (input.languageFlag)
            reviewReasons.push(input.languageFlag);
        if (input.ocrUnavailableReason)
            reviewReasons.push(input.ocrUnavailableReason);
        if (graph.unresolvedReferences.length > 0)
            reviewReasons.push(`unresolved_references:${graph.unresolvedReferences.length}`);
        const dominantTopics = this.computeDominantTopics(graph.topicTags);
        return {
            documentId: input.documentId,
            documentType: input.documentType,
            language: input.language,
            dominantTopics,
            graph,
            retrievableUnits,
            confidenceScore,
            needsReview: reviewReasons.length > 0 || confidenceScore < 0.5,
            reviewReasons,
        };
    }
    computeDominantTopics(topicTagsBySection) {
        const totals = new Map();
        for (const tags of Object.values(topicTagsBySection)) {
            for (const tag of tags) {
                totals.set(tag.topic, (totals.get(tag.topic) || 0) + tag.confidence);
            }
        }
        return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic]) => topic);
    }
};
exports.MetadataAssemblyStage = MetadataAssemblyStage;
exports.MetadataAssemblyStage = MetadataAssemblyStage = __decorate([
    (0, common_1.Injectable)()
], MetadataAssemblyStage);
//# sourceMappingURL=metadata-assembly.stage.js.map