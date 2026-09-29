"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const illustration_extraction_stage_1 = require("./illustration-extraction.stage");
function section(text) {
    return { id: 's1', treeNodeId: 't1', hierarchyPath: 'x', sectionType: 'statutory_provision', text, confidence: 0.9, needsReview: false };
}
describe('IllustrationExtractionStage', () => {
    const stage = new illustration_extraction_stage_1.IllustrationExtractionStage();
    it('extracts a statutory "Illustration:" pattern', () => {
        const s = section('Illustration: A sells goods to B who fails to pay the agreed price.');
        const result = stage.extract(s, [], []);
        expect(result).toHaveLength(1);
        expect(result[0].illustrationType).toBe('statutory');
    });
    it('extracts an instructional hypothetical ("for example"/"suppose")', () => {
        const s = section('For example, suppose A agrees to sell his car to B for a fixed price.');
        const result = stage.extract(s, [], []);
        expect(result.some((i) => i.illustrationType === 'instructional_hypothetical')).toBe(true);
    });
    it('links an illustration to the nearest definition in the same section', () => {
        const s = section('"restriction" means any limit imposed by law. For example, a curfew order is one such restriction.');
        const definitions = [{ id: 'def-1', sectionId: 's1', term: 'restriction', definitionText: 'x', definitionType: 'statutory', scope: 'local' }];
        const result = stage.extract(s, definitions, []);
        expect(result.some((i) => i.linkedDefinitionId === 'def-1')).toBe(true);
    });
});
//# sourceMappingURL=illustration-extraction.stage.spec.js.map