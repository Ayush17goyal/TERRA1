"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const structural_skeleton_stage_1 = require("./structural-skeleton.stage");
const sample_inputs_1 = require("../__fixtures__/sample-inputs");
function cleanedFromParagraphs(text, styleHints = []) {
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    return {
        cleaningLog: [],
        blocks: paragraphs.map((t, i) => ({ index: i, text: t, styleHints: styleHints[i] || {}, needsOCR: false })),
    };
}
describe('StructuralSkeletonStage', () => {
    const stage = new structural_skeleton_stage_1.StructuralSkeletonStage();
    it('detects numbering-pattern headings (PART / Article) at the correct levels', () => {
        const cleaned = cleanedFromParagraphs(sample_inputs_1.BARE_ACT_TEXT);
        const tree = stage.build(cleaned);
        const partNode = tree.root.find((n) => n.title.startsWith('PART'));
        expect(partNode).toBeDefined();
        expect(partNode.level).toBe(1);
        const articleNode = partNode.children.find((n) => n.title.startsWith('Article 19'));
        expect(articleNode).toBeDefined();
        expect(articleNode.level).toBe(3);
    });
    it('trusts a native DOCX heading hint directly, at high confidence', () => {
        const cleaned = {
            cleaningLog: [],
            blocks: [
                { index: 0, text: 'Chapter One', styleHints: { nativeHeadingLevel: 2 }, needsOCR: false },
                { index: 1, text: 'Some body text follows here.', styleHints: {}, needsOCR: false },
            ],
        };
        const tree = stage.build(cleaned);
        expect(tree.root[0].title).toBe('Chapter One');
        expect(tree.root[0].level).toBe(2);
        expect(tree.root[0].confidence).toBeGreaterThanOrEqual(0.9);
    });
    it('classifies a bare-act fixture as bare_act', () => {
        const tree = stage.build(cleanedFromParagraphs(sample_inputs_1.BARE_ACT_TEXT));
        expect(tree.documentType).toBe('bare_act');
    });
    it('classifies a case-compilation fixture as case_compilation', () => {
        const tree = stage.build(cleanedFromParagraphs(sample_inputs_1.CASE_COMPILATION_TEXT));
        expect(tree.documentType).toBe('case_compilation');
    });
});
//# sourceMappingURL=structural-skeleton.stage.spec.js.map