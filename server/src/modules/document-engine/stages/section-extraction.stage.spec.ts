import { SectionExtractionStage } from './section-extraction.stage';
import { StructuralSkeletonStage } from './structural-skeleton.stage';
import { CleanedDocument } from '../types/document-graph.types';
import { BARE_ACT_TEXT } from '../__fixtures__/sample-inputs';

// Builds tree + cleaned doc via the already-tested StructuralSkeletonStage so the offsets the two
// stages agree on stay consistent (hand-computing matching offsets independently would be
// fragile/error-prone) — this spec is still testing SectionExtractionStage's own assignment and
// orphan-routing logic, not re-testing heading detection.
function cleanedFromParagraphs(text: string): CleanedDocument {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return { cleaningLog: [], blocks: paragraphs.map((t, i) => ({ index: i, text: t, styleHints: {}, needsOCR: false })) };
}

describe('SectionExtractionStage', () => {
  const skeleton = new StructuralSkeletonStage();
  const stage = new SectionExtractionStage();

  it('assigns body text to the correct tree node by hierarchy path', () => {
    const cleaned = cleanedFromParagraphs(BARE_ACT_TEXT);
    const tree = skeleton.build(cleaned);
    const sections = stage.extract(cleaned, tree);

    const articleSection = sections.find((s) => s.hierarchyPath.includes('Article 19'));
    expect(articleSection).toBeDefined();
    expect(articleSection!.text.length).toBeGreaterThan(0);
    expect(articleSection!.sectionType).toBe('statutory_provision');
  });

  it('routes text before the first detected heading into the orphaned/needsReview bucket', () => {
    const cleaned: CleanedDocument = {
      cleaningLog: [],
      blocks: [
        { index: 0, text: 'Some preliminary remark with no heading above it.', styleHints: {}, needsOCR: false },
        { index: 1, text: 'PART I', styleHints: {}, needsOCR: false },
        { index: 2, text: 'Body text under Part I.', styleHints: {}, needsOCR: false },
      ],
    };
    const tree = skeleton.build(cleaned);
    const sections = stage.extract(cleaned, tree);

    const orphan = sections.find((s) => s.treeNodeId === null);
    expect(orphan).toBeDefined();
    expect(orphan!.needsReview).toBe(true);
    expect(orphan!.text).toContain('preliminary remark');
  });
});
