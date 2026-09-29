import { TopicDetectionStage } from './topic-detection.stage';
import { SectionNode } from '../types/document-graph.types';

function section(text: string): SectionNode {
  return { id: 's1', treeNodeId: 't1', hierarchyPath: 'x', sectionType: 'statutory_provision', text, confidence: 0.9, needsReview: false };
}

describe('TopicDetectionStage', () => {
  const stage = new TopicDetectionStage();

  it('tags Constitutional Law / Fundamental Rights for an Article 19-style section', () => {
    const s = section('Article 19, found in the Fundamental Rights chapter, protects freedom of speech and expression.');
    const tags = stage.classifyTopics(s);
    expect(tags.some((t) => t.topic === 'Constitutional Law')).toBe(true);
    const subtopics = stage.classifySubtopics(s, tags);
    expect(subtopics.some((st) => st.subtopic === 'Fundamental Rights')).toBe(true);
  });

  it('returns no tags for a section with no taxonomy keywords', () => {
    const s = section('The cat sat quietly on the warm windowsill all afternoon.');
    expect(stage.classifyTopics(s)).toHaveLength(0);
  });

  it('detects exam-relevant constructs (exception, holding)', () => {
    const s = section('Provided that this restriction shall not apply to reasonable limits. It was held that the law is valid.');
    const constructs = stage.detectConstructs(s);
    expect(constructs.some((c) => c.constructType === 'exception')).toBe(true);
    expect(constructs.some((c) => c.constructType === 'holding')).toBe(true);
  });
});
