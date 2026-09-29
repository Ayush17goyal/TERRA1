import type { LLMExecutionRecord } from '../types';

export interface LLMExecutionStore {
  insert(record: Record<string, unknown>): Promise<{ error?: unknown }>;
}

export class LLMExecutionRepository {
  private readonly store?: LLMExecutionStore;

  constructor(store?: LLMExecutionStore) {
    this.store = store;
  }

  async save(record: LLMExecutionRecord): Promise<void> {
    if (!this.store) {
      return;
    }

    const { error } = await this.store.insert({
      request_id: record.requestId,
      interaction_id: record.interactionId,
      student_id: record.studentId,
      intent: record.intent,
      teaching_strategy: record.teachingStrategy,
      prompt_version: record.promptVersion,
      model: record.model,
      latency_ms: record.latencyMs,
      stream_duration_ms: record.streamDurationMs,
      retry_count: record.retryCount,
      cache_hit: record.cacheHit,
      tool_calls: record.toolCalls,
      usage: record.usage,
      cost: record.cost,
      retrieval_statistics: record.retrievalStatistics,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to store LLM execution record: ${JSON.stringify(error)}`);
    }
  }
}
