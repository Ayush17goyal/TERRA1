"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const case_extraction_stage_1 = require("./case-extraction.stage");
const sample_inputs_1 = require("../__fixtures__/sample-inputs");
function section(text) {
    return { id: 's1', treeNodeId: 't1', hierarchyPath: 'x', sectionType: 'case_paragraph', text, confidence: 0.9, needsReview: false };
}
describe('CaseExtractionStage', () => {
    const stage = new case_extraction_stage_1.CaseExtractionStage();
    it('extracts a "X v. Y" case name with year and court from context', () => {
        const s = section('In Kesavananda Bharati v. State of Kerala, AIR 1973 SC 1461, the Supreme Court considered the basic structure doctrine.');
        const cases = stage.extract(s, 'case_compilation');
        expect(cases).toHaveLength(1);
        expect(cases[0].caseName).toBe('Kesavananda Bharati v. State of Kerala');
        expect(cases[0].year).toBe('1973');
        expect(cases[0].court).toMatch(/Supreme Court/i);
    });
    it('populates facts/issues/held/ratio for a full case-compilation fixture', () => {
        const s = section(sample_inputs_1.CASE_COMPILATION_TEXT);
        const cases = stage.extract(s, 'case_compilation');
        expect(cases[0].mentionType).toBe('full');
        expect(cases[0].structured?.facts).toBeTruthy();
        expect(cases[0].structured?.held).toBeTruthy();
        expect(cases[0].structured?.ratio).toBeTruthy();
    });
    it('treats a short in-passing case reference in notes as a mention with no structure', () => {
        const s = section('As held in Kesavananda Bharati v. State of Kerala, the amending power is limited.');
        const cases = stage.extract(s, 'notes');
        expect(cases[0].mentionType).toBe('mention');
        expect(cases[0].structured).toBeNull();
    });
});
//# sourceMappingURL=case-extraction.stage.spec.js.map