import { describe, expect, it } from 'vitest';
import { KnowledgeRetrievalEngine } from '../../knowledge/engine/KnowledgeRetrievalEngine';
import { DeterministicEmbeddingService, InMemoryKnowledgeRepository } from '../fixtures/mentor-fixtures';

function engine() {
  return new KnowledgeRetrievalEngine({ repository: new InMemoryKnowledgeRepository(), embeddingService: new DeterministicEmbeddingService() });
}

describe('KnowledgeRetrievalEngine', () => {
  it('retrieves minimum learning context with lesson, pattern, and teaching rules', async () => {
    const result = await engine().retrieveForLearning({ userMessage: 'Teach definitions', intent: 'learning', teachingStrategy: 'teach', studentLevel: 'beginner', moduleId: 'm1', lessonId: 'l1', tokenBudget: 900 });
    expect(result.items.map((item) => item.kind)).toEqual(expect.arrayContaining(['lesson', 'pattern', 'teaching_rule']));
    expect(result.usedTokens).toBeLessThanOrEqual(result.tokenBudget);
  });

  it('uses keyword fallback when vector retrieval fails', async () => {
    const repository = new InMemoryKnowledgeRepository();
    const brokenEmbeddings = new DeterministicEmbeddingService();
    brokenEmbeddings.generateEmbedding = async () => { throw new Error('embedding outage'); };
    const result = await new KnowledgeRetrievalEngine({ repository, embeddingService: brokenEmbeddings }).retrieveForReview({ userMessage: 'Review my draft', intent: 'review', teachingStrategy: 'review', studentLevel: 'developing', tokenBudget: 900 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.warnings.join(' ')).toContain('keyword fallback');
  });
});
