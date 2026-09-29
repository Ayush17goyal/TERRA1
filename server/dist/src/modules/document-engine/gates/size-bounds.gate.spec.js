"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const size_bounds_gate_1 = require("./size-bounds.gate");
const document_engine_constants_1 = require("../document-engine.constants");
function docWithChars(count) {
    return { sourceFormat: 'text', blocks: [{ index: 0, text: 'x'.repeat(count), styleHints: {}, needsOCR: false }] };
}
describe('SizeBoundsGate', () => {
    const gate = new size_bounds_gate_1.SizeBoundsGate();
    it('fails just below the minimum extractable character threshold', () => {
        const result = gate.checkMinimumContent(docWithChars(document_engine_constants_1.MIN_EXTRACTABLE_CHARACTERS - 1));
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('insufficient_extractable_content');
    });
    it('passes just above the minimum extractable character threshold', () => {
        const result = gate.checkMinimumContent(docWithChars(document_engine_constants_1.MIN_EXTRACTABLE_CHARACTERS + 1));
        expect(result.passed).toBe(true);
    });
});
//# sourceMappingURL=size-bounds.gate.spec.js.map