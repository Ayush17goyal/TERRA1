"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const metadata_assembly_stage_1 = require("./metadata-assembly.stage");
function graphWithSections(sections) {
    return {
        tree: { documentType: 'bare_act', documentTypeConfidence: 0.8, root: [] },
        sections,
        topicTags: {},
        subtopicTags: {},
        examConstructs: [],
        definitions: [],
        illustrations: [],
        cases: [],
        citations: [],
        unresolvedReferences: [],
    };
}
describe('MetadataAssemblyStage', () => {
    const stage = new metadata_assembly_stage_1.MetadataAssemblyStage();
    it('aggregates confidence from section confidences and document-type confidence', () => {
        const graph = graphWithSections([
            { id: 's1', treeNodeId: 't1', hierarchyPath: 'x', sectionType: 'statutory_provision', text: 'a', confidence: 1, needsReview: false },
            { id: 's2', treeNodeId: 't2', hierarchyPath: 'y', sectionType: 'statutory_provision', text: 'b', confidence: 1, needsReview: false },
        ]);
        const record = stage.assemble({ documentId: 'doc-1', documentType: 'bare_act', documentTypeConfidence: 1, language: 'en', graph });
        expect(record.confidenceScore).toBeCloseTo(1);
        expect(record.needsReview).toBe(false);
    });
    it('flags needsReview when confidence drops below 0.5 or any reason is present', () => {
        const graph = graphWithSections([
            { id: 's1', treeNodeId: 't1', hierarchyPath: 'x', sectionType: 'statutory_provision', text: 'a', confidence: 0.1, needsReview: true },
        ]);
        const record = stage.assemble({ documentId: 'doc-1', documentType: 'unknown', documentTypeConfidence: 0.1, language: 'en', graph });
        expect(record.needsReview).toBe(true);
        expect(record.reviewReasons.some((r) => r.startsWith('low_confidence_section'))).toBe(true);
        expect(record.reviewReasons).toContain('low_confidence_document_type_classification');
    });
    it('generates one retrievable unit per section/definition/case/illustration', () => {
        const graph = {
            ...graphWithSections([
                { id: 's1', treeNodeId: 't1', hierarchyPath: 'Act > Sec 3', sectionType: 'statutory_provision', text: 'body', confidence: 0.9, needsReview: false },
            ]),
            definitions: [{ id: 'd1', sectionId: 's1', term: 'minor', definitionText: 'a person under 18', definitionType: 'statutory', scope: 'local' }],
            cases: [{ id: 'c1', sectionId: 's1', caseName: 'X v. Y', parties: null, court: null, year: null, mentionType: 'mention', structured: null, context: '' }],
            illustrations: [{ id: 'i1', sectionId: 's1', text: 'example text', illustrationType: 'statutory', linkedDefinitionId: null, linkedConstructSectionId: null }],
        };
        const record = stage.assemble({ documentId: 'doc-1', documentType: 'bare_act', documentTypeConfidence: 0.9, language: 'en', graph });
        const types = record.retrievableUnits.map((u) => u.type).sort();
        expect(types).toEqual(['case', 'definition', 'illustration', 'section']);
    });
});
//# sourceMappingURL=metadata-assembly.stage.spec.js.map