"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const non_legal_content_gate_1 = require("./non-legal-content.gate");
const sample_inputs_1 = require("../__fixtures__/sample-inputs");
const bareActTree = { documentType: 'bare_act', documentTypeConfidence: 0.8, root: [] };
const unknownTree = { documentType: 'unknown', documentTypeConfidence: 0.1, root: [] };
describe('NonLegalContentGate', () => {
    const gate = new non_legal_content_gate_1.NonLegalContentGate();
    it('passes a legal-keyword-dense document', () => {
        const result = gate.check(sample_inputs_1.BARE_ACT_TEXT, bareActTree);
        expect(result.passed).toBe(true);
    });
    it('fails a low-density, unclassified document', () => {
        const result = gate.check(sample_inputs_1.NON_LEGAL_TEXT, unknownTree);
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('non_legal_content_suspected');
    });
});
//# sourceMappingURL=non-legal-content.gate.spec.js.map