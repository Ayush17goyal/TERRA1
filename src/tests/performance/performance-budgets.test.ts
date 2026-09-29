import { describe, expect, it } from 'vitest';
import { PromptAssemblyEngine } from '../../ai/prompts/assembler/PromptAssemblyEngine';
import { KnowledgeRetrievalEngine } from '../../knowledge/engine/KnowledgeRetrievalEngine';
import { ResponseValidator } from '../../validator/engine/ResponseValidator';
import { DeterministicEmbeddingService, InMemoryKnowledgeRepository, llmResponse, promptRequest, runtimePacket } from '../fixtures/mentor-fixtures';

async function measure<T>(fn: () => T | Promise<T>) {
  const start = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - start };
}

describe('Performance budgets', () => {
  it('keeps retrieval, prompt assembly, and validation under local CPU budgets', async () => {
    const retrieval = await measure(() => new KnowledgeRetrievalEngine({ repository: new InMemoryKnowledgeRepository(), embeddingService: new DeterministicEmbeddingService() }).retrieveForLearning({ userMessage: 'definitions', intent: 'learning', teachingStrategy: 'teach', studentLevel: 'beginner', tokenBudget: 1200 }));
    const assembly = await measure(() => new PromptAssemblyEngine().assemble(promptRequest()));
    const validation = await measure(() => new ResponseValidator().validate(runtimePacket(), llmResponse()));
    expect(retrieval.ms).toBeLessThan(250);
    expect(assembly.ms).toBeLessThan(100);
    expect(validation.ms).toBeLessThan(100);
  });
});
