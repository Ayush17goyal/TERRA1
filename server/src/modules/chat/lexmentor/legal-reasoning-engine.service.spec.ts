import { LegalReasoningEngine } from './legal-reasoning-engine.service';
import { BuiltLegalContext, RetrievedAuthority } from './pipeline.types';

const authority: RetrievedAuthority = {
  id: 'a1',
  collection: 'Bare Acts',
  collectionName: 'Bare Acts',
  title: 'Indian Contract Act, 1872',
  sourceDocument: 'Indian Contract Act.pdf',
  section: '10',
  chunkText: 'Section 10 states which agreements are contracts.',
  retrievalScore: 0.92,
  rerankerScore: 0.9,
  authorityStrength: 0.8,
  metadata: {},
};

const context: BuiltLegalContext = {
  contextBlock: '[A1] Bare Acts: Indian Contract Act, 1872\nReference: Section 10\nExcerpt: Section 10 states which agreements are contracts.',
  authorities: [authority],
  hasAuthoritativeSources: true,
  tokenEstimate: 100,
};

describe('LegalReasoningEngine', () => {
  it('uses strict legal generation parameters for detailed answers', async () => {
    const complete = jest.fn().mockResolvedValue({
      content: 'grounded answer',
      provider: 'test-provider',
      model: 'test-model',
    });
    const engine = new LegalReasoningEngine({ complete } as any);

    await engine.generate({
      query: 'Explain Section 10 of Indian Contract Act',
      depth: 'Intermediate',
      intent: 'Bare Act',
      context,
      history: [],
      evidenceValidation: {
        confidence: 'high',
        confidenceScore: 0.9,
        canGenerateDefinitiveAnswer: true,
        hasRelevantLegalEvidence: true,
        sectionOrArticleExists: true,
        retrievedTextMatchesQuestion: true,
        sourceAuthoritative: true,
        hasConflictingSources: false,
        reason: 'Retrieved legal evidence supports a grounded answer.',
      },
    });

    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 0.1,
      topP: 0.2,
      frequencyPenalty: 0,
      presencePenalty: 0,
      maxTokens: 1500,
    }));
  });

  it('uses legal research token budget for research intent', async () => {
    const complete = jest.fn().mockResolvedValue({
      content: 'grounded research answer',
      provider: 'test-provider',
      model: 'test-model',
    });
    const engine = new LegalReasoningEngine({ complete } as any);

    await engine.generate({
      query: 'Research constitutional privacy principles',
      depth: 'Expert',
      intent: 'Research',
      context,
      history: [],
    });

    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 2500 }));
  });
});