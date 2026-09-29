"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageDetectionGate = void 0;
const common_1 = require("@nestjs/common");
const SCRIPT_RANGES = [
    { language: 'hi', regex: /[ऀ-ॿ]/ },
    { language: 'bn', regex: /[ঀ-৿]/ },
    { language: 'ta', regex: /[஀-௿]/ },
    { language: 'te', regex: /[ఀ-౿]/ },
    { language: 'gu', regex: /[઀-૿]/ },
    { language: 'ur', regex: /[؀-ۿ]/ },
];
const SUPPORTED_LANGUAGES = new Set(['en']);
let LanguageDetectionGate = class LanguageDetectionGate {
    detect(doc) {
        const sample = doc.blocks.map((b) => b.text).join(' ').slice(0, 20_000);
        const totalChars = sample.replace(/\s/g, '').length || 1;
        let dominantNonLatin = null;
        for (const { language, regex } of SCRIPT_RANGES) {
            const matches = sample.match(new RegExp(regex, 'g'));
            const count = matches ? matches.length : 0;
            if (count > 0 && (!dominantNonLatin || count > dominantNonLatin.count)) {
                dominantNonLatin = { language, count };
            }
        }
        if (!dominantNonLatin) {
            return { language: 'en', mixed: false };
        }
        const nonLatinRatio = dominantNonLatin.count / totalChars;
        if (nonLatinRatio < 0.05) {
            return { language: 'en', mixed: true };
        }
        return { language: dominantNonLatin.language, mixed: true };
    }
    check(doc) {
        const { language, mixed } = this.detect(doc);
        if (!SUPPORTED_LANGUAGES.has(language)) {
            return {
                passed: true,
                reason: 'unsupported_language',
                metadata: { language, mixed },
                language,
            };
        }
        if (mixed) {
            return { passed: true, reason: 'mixed_language_content', metadata: { language, mixed }, language };
        }
        return { passed: true, language };
    }
};
exports.LanguageDetectionGate = LanguageDetectionGate;
exports.LanguageDetectionGate = LanguageDetectionGate = __decorate([
    (0, common_1.Injectable)()
], LanguageDetectionGate);
//# sourceMappingURL=language-detection.gate.js.map