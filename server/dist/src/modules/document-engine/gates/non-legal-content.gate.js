"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NonLegalContentGate = void 0;
const common_1 = require("@nestjs/common");
const document_engine_constants_1 = require("../document-engine.constants");
let NonLegalContentGate = class NonLegalContentGate {
    check(fullText, tree) {
        const lower = fullText.toLowerCase();
        const totalChars = lower.length || 1;
        let hits = 0;
        for (const keyword of document_engine_constants_1.NON_LEGAL_GATE_KEYWORDS) {
            const occurrences = lower.split(keyword).length - 1;
            hits += occurrences;
        }
        const densityPer1000 = (hits / totalChars) * 1000;
        const structurallyUnclassified = tree.documentType === 'unknown' && tree.documentTypeConfidence < 0.3;
        if (densityPer1000 < document_engine_constants_1.NON_LEGAL_GATE_MIN_DENSITY && structurallyUnclassified) {
            return {
                passed: false,
                reason: 'non_legal_content_suspected',
                metadata: { keywordDensityPer1000: densityPer1000, documentType: tree.documentType },
            };
        }
        return { passed: true, metadata: { keywordDensityPer1000: densityPer1000 } };
    }
};
exports.NonLegalContentGate = NonLegalContentGate;
exports.NonLegalContentGate = NonLegalContentGate = __decorate([
    (0, common_1.Injectable)()
], NonLegalContentGate);
//# sourceMappingURL=non-legal-content.gate.js.map