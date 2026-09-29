"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextCleaningStage = void 0;
const common_1 = require("@nestjs/common");
let TextCleaningStage = class TextCleaningStage {
    clean(doc) {
        const cleaningLog = [];
        const textCounts = new Map();
        for (const block of doc.blocks) {
            const key = block.text.trim();
            if (key.length > 0 && key.length < 120) {
                textCounts.set(key, (textCounts.get(key) || 0) + 1);
            }
        }
        const repetitionThreshold = Math.max(3, Math.floor(doc.blocks.length / 3));
        const repeatedTexts = new Set([...textCounts.entries()].filter(([, count]) => count >= repetitionThreshold).map(([text]) => text));
        const cleanedBlocks = [];
        for (const block of doc.blocks) {
            const removed = [];
            let text = block.text;
            const trimmed = text.trim();
            if (repeatedTexts.has(trimmed)) {
                removed.push('repeated header/footer');
                cleanedBlocks.push({ ...block, text: '' });
                cleaningLog.push({ blockIndex: block.index, removed });
                continue;
            }
            if (/^(page\s+)?\d+(\s+of\s+\d+)?$/i.test(trimmed)) {
                removed.push('page-number footer');
                cleanedBlocks.push({ ...block, text: '' });
                cleaningLog.push({ blockIndex: block.index, removed });
                continue;
            }
            const beforeHyphenFix = text;
            text = text.replace(/(\w)-\n(\w)/g, '$1$2').replace(/(\w)-\s+(\w)/g, (m, a, b) => `${a}${b}`);
            if (text !== beforeHyphenFix)
                removed.push('hyphenation rejoin');
            const beforeOcrFix = text;
            text = text.replace(/\bSS\b(?=\s*\d)/g, '§§').replace(/\bS\.(\s*\d)/g, '§.$1');
            if (text !== beforeOcrFix)
                removed.push('OCR artifact correction');
            const beforeWhitespaceFix = text;
            text = text.replace(/[ \t]{2,}/g, ' ').replace(/ /g, ' ').trim();
            if (text !== beforeWhitespaceFix)
                removed.push('whitespace normalization');
            cleanedBlocks.push({ ...block, text });
            if (removed.length > 0)
                cleaningLog.push({ blockIndex: block.index, removed });
        }
        return { blocks: cleanedBlocks.filter((b) => b.text.length > 0), cleaningLog };
    }
};
exports.TextCleaningStage = TextCleaningStage;
exports.TextCleaningStage = TextCleaningStage = __decorate([
    (0, common_1.Injectable)()
], TextCleaningStage);
//# sourceMappingURL=text-cleaning.stage.js.map