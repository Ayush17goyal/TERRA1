import { describe, expect, it, vi } from 'vitest';
import { LLMService } from '../../llm/services/LLMService';
import { runtimePacket } from '../fixtures/mentor-fixtures';

class FakeClient {
  createResponse = vi.fn(async () => ({ model: 'gpt-test', output_text: 'Learning objective: explain definitions. Next action: revise one term.', usage: { input_tokens: 10, output_tokens: 8, total_tokens: 18 } }));
  streamResponse = vi.fn();
}

class MemoryExecutionRepository {
  records: unknown[] = [];
  async save(record: unknown) { this.records.push(record); }
}

describe('LLMService', () => {
  it('uses PromptExecutor and records token/cost telemetry without manual prompt construction', async () => {
    const client = new FakeClient();
    const repository = new MemoryExecutionRepository();
    const service = new LLMService({ client: client as any, executionRepository: repository as any, defaultModel: 'gpt-test' });
    const response = await service.generateExplanation(runtimePacket());
    expect(client.createResponse).toHaveBeenCalledTimes(1);
    const firstRequest = (client.createResponse as any).mock.calls[0]?.[0] as any;
    expect(String(firstRequest.input)).toContain('current_user_message');
    expect(response.usage.totalTokens).toBe(18);
    expect(repository.records).toHaveLength(1);
  });
});
