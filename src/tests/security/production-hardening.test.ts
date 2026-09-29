import { describe, expect, it } from 'vitest';
import { MentorApiService } from '../../api/services/MentorApiService';
import { ApiMiddleware } from '../../api/middleware/ApiMiddleware';
import { ApiTelemetry } from '../../api/telemetry/ApiTelemetry';
import { createWorkflowDependencies } from '../../workflow/WorkflowCoordinator';
import { llmResponse } from '../fixtures/mentor-fixtures';

function withProductionEnv<T>(operation: () => T): T {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    return operation();
  } finally {
    process.env.NODE_ENV = previous;
  }
}

describe('Production runtime safety', () => {
  it('fails fast instead of creating unsafe API defaults in production', () => {
    withProductionEnv(() => {
      expect(() => new MentorApiService()).toThrow(/missing required dependencies/i);
      expect(() => new ApiMiddleware()).toThrow(/missing required dependencies/i);
      expect(() => new ApiTelemetry()).toThrow(/missing required logger/i);
    });
  });

  it('fails fast instead of creating no-op workflow adapters in production', () => {
    withProductionEnv(() => {
      expect(() => createWorkflowDependencies({ knowledgeRetrieval: {} as any, llm: {} as any, validator: {} as any })).toThrow(/Workflow dependencies are not production-ready/i);
    });
  });

  it('does not stream high-risk draft-review text before educational validation approves it', async () => {
    const events = [
      { type: 'text_delta', delta: 'Submission-ready section text that should not leak.' },
      { type: 'completion', response: llmResponse('Blocked completion') },
    ];
    const service = new MentorApiService({
      llmService: { streamResponse: async function* () { for (const event of events) yield event; } } as any,
      responseValidator: { approve: () => ({ action: 'block_response', violations: [{ ruleId: 'no_ghostwriting', severity: 'BLOCKING' }], response: { text: 'blocked' }, telemetry: {} }) } as any,
      knowledgeEngine: { retrieveForReview: async () => ({ items: [], usedTokens: 0, omitted: [], stats: { retrieversUsed: [], cacheHit: false, rankingSignals: [] } }) } as any,
      persistence: { saveInteraction: async () => undefined, saveProgress: async () => undefined, getStudentResource: async () => undefined, getKnowledgeResource: async () => undefined, saveDocumentUpload: async () => undefined },
      jobs: { eventBus: { emit: async () => undefined } } as any,
    });

    const stream = await service.streamAI({ requestId: 'r1', correlationId: 'c1', startedAt: Date.now(), method: 'POST', path: '/api/chat/stream', params: {}, user: { id: 'student-1', roles: ['student'] } }, { message: 'review this', draftText: 'section 1', draftObjective: 'review', componentType: 'definitions' } as any);
    const emitted: Array<{ event: string; data: any }> = [];
    for await (const event of stream) emitted.push(event as any);

    expect(emitted.some((event) => event.event === 'text')).toBe(false);
    expect(emitted.some((event) => event.event === 'error' && /blocked/i.test(String(event.data.message)))).toBe(true);
  });
});