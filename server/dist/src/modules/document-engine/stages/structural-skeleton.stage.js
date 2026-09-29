"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuralSkeletonStage = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const NUMBERING_PATTERNS = [
    { regex: /^(PART|Part)\s+[IVXLC0-9]+/, level: 1 },
    { regex: /^(CHAPTER|Chapter)\s+[IVXLC0-9]+/, level: 2 },
    { regex: /^(Article|ARTICLE)\s+\d+[A-Za-z]?/, level: 3 },
    { regex: /^(Section|SECTION|Sec\.?)\s+\d+[A-Za-z]?/, level: 3 },
    { regex: /^\(\d+\)/, level: 4 },
    { regex: /^\([a-z]\)/, level: 5 },
    { regex: /^\d+\.\d+/, level: 3 },
    { regex: /^\d+\.\s/, level: 3 },
];
const DOC_TYPE_SIGNALS = {
    bare_act: [/\bhereby\s+enacted\b/i, /\bshort title\b/i, /\bcame into force\b/i, /\bAct,?\s+\d{4}\b/, /\bprovided\s+that\b/i, /\barticle\s+\d+/i],
    case_compilation: [/\bv\.?s?\.\s/i, /\bpetitioner\b/i, /\brespondent\b/i, /\bAIR\s+\d{4}/, /\bSCC\b/, /\bheld\s*:/i],
    notes: [/^unit\s+\d/im, /^class\s+\d/im, /^topic\s*:/im, /^notes\s*:/im],
    textbook: [/\bchapter\s+\d+\b/i, /\bintroduction\b/i, /\bsummary\b/i, /\bexercises?\b/i],
    unknown: [],
};
let StructuralSkeletonStage = class StructuralSkeletonStage {
    build(doc) {
        const documentType = this.classifyDocumentType(doc);
        const root = [];
        const stack = [];
        let offset = 0;
        for (const block of doc.blocks) {
            const blockStart = offset;
            const blockEnd = offset + block.text.length;
            offset = blockEnd + 1;
            const heading = this.detectHeading(block.text, block.styleHints);
            if (!heading)
                continue;
            const node = {
                id: crypto.randomUUID(),
                level: heading.level,
                title: block.text.slice(0, 200),
                startOffset: blockStart,
                endOffset: blockEnd,
                confidence: heading.confidence,
                children: [],
            };
            while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
                stack.pop();
            }
            if (stack.length === 0) {
                root.push(node);
            }
            else {
                stack[stack.length - 1].children.push(node);
            }
            stack.push(node);
        }
        return { documentType: documentType.type, documentTypeConfidence: documentType.confidence, root };
    }
    detectHeading(text, styleHints) {
        if (styleHints.nativeHeadingLevel) {
            return { level: styleHints.nativeHeadingLevel, confidence: 0.95 };
        }
        for (const { regex, level } of NUMBERING_PATTERNS) {
            if (regex.test(text.trim())) {
                const corroborated = styleHints.bold ? 0.9 : 0.75;
                return { level, confidence: corroborated };
            }
        }
        const trimmed = text.trim();
        if (trimmed.length > 0 && trimmed.length < 80 && trimmed === trimmed.toUpperCase() && !/[.,;]$/.test(trimmed) && /[A-Z]/.test(trimmed)) {
            return { level: 2, confidence: styleHints.bold ? 0.6 : 0.4 };
        }
        if (styleHints.bold && trimmed.length < 100 && !/[.]$/.test(trimmed)) {
            return { level: 3, confidence: 0.5 };
        }
        return null;
    }
    classifyDocumentType(doc) {
        const fullText = doc.blocks.map((b) => b.text).join('\n');
        const scores = { bare_act: 0, case_compilation: 0, notes: 0, textbook: 0 };
        for (const [type, patterns] of Object.entries(DOC_TYPE_SIGNALS)) {
            if (type === 'unknown')
                continue;
            for (const pattern of patterns) {
                if (pattern.test(fullText))
                    scores[type] += 1;
            }
        }
        const [bestType, bestScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
        const totalSignals = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
        if (bestScore === 0) {
            return { type: 'unknown', confidence: 0 };
        }
        return { type: bestType, confidence: Math.min(0.95, bestScore / totalSignals + 0.2) };
    }
};
exports.StructuralSkeletonStage = StructuralSkeletonStage;
exports.StructuralSkeletonStage = StructuralSkeletonStage = __decorate([
    (0, common_1.Injectable)()
], StructuralSkeletonStage);
//# sourceMappingURL=structural-skeleton.stage.js.map