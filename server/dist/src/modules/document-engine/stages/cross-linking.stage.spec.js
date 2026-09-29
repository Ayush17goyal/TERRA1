"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cross_linking_stage_1 = require("./cross-linking.stage");
const tree = { documentType: 'bare_act', documentTypeConfidence: 0.8, root: [] };
function baseInput(overrides = {}) {
    return {
        tree,
        sections: overrides.sections ?? [],
        topicTags: {},
        subtopicTags: {},
        examConstructs: [],
        definitions: [],
        illustrations: [],
        cases: overrides.cases ?? [],
        citations: overrides.citations ?? [],
    };
}
describe('CrossLinkingStage', () => {
    const stage = new cross_linking_stage_1.CrossLinkingStage();
    it('resolves a cross-reference citation to a section whose hierarchy path matches', () => {
        const sections = [
            { id: 'sec-3', treeNodeId: 't1', hierarchyPath: 'The Act > Section 3', sectionType: 'statutory_provision', text: 'x', confidence: 0.9, needsReview: false },
        ];
        const citations = [
            { id: 'cit-1', sectionId: 'sec-other', rawText: 'as defined in Section 3 above', citationType: 'cross_reference', normalizedForm: 'Section 3', resolvedTargetId: null },
        ];
        const result = stage.link(baseInput({ sections, citations }));
        expect(result.citations[0].resolvedTargetId).toBe('sec-3');
        expect(result.unresolvedReferences).toHaveLength(0);
    });
    it('flags an unresolved cross-reference when no matching section exists', () => {
        const citations = [
            { id: 'cit-1', sectionId: 'sec-1', rawText: 'as defined in Section 99 above', citationType: 'cross_reference', normalizedForm: 'Section 99', resolvedTargetId: null },
        ];
        const result = stage.link(baseInput({ citations }));
        expect(result.citations[0].resolvedTargetId).toBeNull();
        expect(result.unresolvedReferences).toHaveLength(1);
        expect(result.unresolvedReferences[0].reason).toBe('cross_reference_target_not_found_in_document');
    });
    it('merges a mention-type case with a full-type case of the same name elsewhere in the document', () => {
        const cases = [
            { id: 'full-1', sectionId: 'sec-1', caseName: 'Kesavananda Bharati v. State of Kerala', parties: null, court: 'Supreme Court', year: '1973', mentionType: 'full', structured: { held: 'held text', ratio: 'ratio text' }, context: '' },
            { id: 'mention-1', sectionId: 'sec-2', caseName: 'Kesavananda Bharati v. State of Kerala', parties: null, court: null, year: null, mentionType: 'mention', structured: null, context: '' },
        ];
        const result = stage.link(baseInput({ cases }));
        const merged = result.cases.find((c) => c.id === 'mention-1');
        expect(merged.structured).toEqual({ held: 'held text', ratio: 'ratio text' });
        expect(merged.court).toBe('Supreme Court');
    });
});
//# sourceMappingURL=cross-linking.stage.spec.js.map