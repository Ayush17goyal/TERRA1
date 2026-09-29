"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const language_detection_gate_1 = require("./language-detection.gate");
const sample_inputs_1 = require("../__fixtures__/sample-inputs");
function docWithText(text) {
    return { sourceFormat: 'text', blocks: [{ index: 0, text, styleHints: {}, needsOCR: false }] };
}
describe('LanguageDetectionGate', () => {
    const gate = new language_detection_gate_1.LanguageDetectionGate();
    it('passes pure English content with no flag', () => {
        const result = gate.check(docWithText(sample_inputs_1.BARE_ACT_TEXT));
        expect(result.language).toBe('en');
        expect(result.reason).toBeUndefined();
    });
    it('flags a Devanagari-dominant document as unsupported_language', () => {
        const result = gate.check(docWithText(sample_inputs_1.HINDI_TEXT));
        expect(result.language).toBe('hi');
        expect(result.reason).toBe('unsupported_language');
    });
    it('flags mixed content (English with a stray non-Latin quoted term) without changing the language', () => {
        const mixed = `${sample_inputs_1.BARE_ACT_TEXT}\n"धारा" is the Hindi word for section.`;
        const result = gate.check(docWithText(mixed));
        expect(result.language).toBe('en');
        expect(result.reason).toBe('mixed_language_content');
    });
});
//# sourceMappingURL=language-detection.gate.spec.js.map