"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const citation_extraction_stage_1 = require("./citation-extraction.stage");
function section(text, id = 's1') {
    return { id, treeNodeId: 't1', hierarchyPath: 'The Act > Section 3', sectionType: 'statutory_provision', text, confidence: 0.9, needsReview: false };
}
describe('CitationExtractionStage', () => {
    const stage = new citation_extraction_stage_1.CitationExtractionStage();
    it('normalizes an AIR case citation', () => {
        const s = section('This principle was affirmed in AIR 1973 SC 1461.');
        const citations = stage.extract(s, []);
        expect(citations.some((c) => c.citationType === 'case' && c.normalizedForm === 'AIR 1973 SC 1461')).toBe(true);
    });
    it('captures a statute citation with act name and year', () => {
        const s = section('Consideration is defined under Section 2 of the Indian Contract Act, 1872.');
        const citations = stage.extract(s, []);
        const statuteCitation = citations.find((c) => c.citationType === 'statute');
        expect(statuteCitation).toBeDefined();
        expect(statuteCitation.normalizedForm).toContain('Indian Contract Act');
        expect(statuteCitation.normalizedForm).toContain('1872');
    });
    it('extracts a cross-reference citation, leaving resolution to the Cross-Linking stage', () => {
        const s = section('As defined in Section 3 above, the term applies.');
        const citations = stage.extract(s, []);
        const crossRef = citations.find((c) => c.citationType === 'cross_reference');
        expect(crossRef).toBeDefined();
        expect(crossRef.normalizedForm).toMatch(/Section 3/i);
        expect(crossRef.resolvedTargetId).toBeNull();
    });
});
//# sourceMappingURL=citation-extraction.stage.spec.js.map