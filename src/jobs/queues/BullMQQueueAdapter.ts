import type { JobEnvelope, JobOptions, JobQueue, JobQueueName } from '../types';

export interface BullQueueLike {
  add(name: string, data: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ id?: string | number }>;
  count(): Promise<number>;
  drain(): Promise<void>;
}

export class BullMQQueueAdapter<TPayload extends Record<string, unknown> = Record<string, unknown>> implements JobQueue<TPayload> {
  readonly name: JobQueueName;
  private readonly queue: BullQueueLike;

  constructor(name: JobQueueName, queue: BullQueueLike) {
    this.name = name;
    this.queue = queue;
  }

  async add(name: string, payload: TPayload, options: JobOptions = {}): Promise<JobEnvelope<TPayload>> {
    const bullJob = await this.queue.add(name, payload, {
      jobId: options.jobId,
      attempts: options.attempts,
      delay: options.delayMs,
      priority: options.priority,
      removeOnComplete: options.removeOnComplete ?? true,
      backoff: options.backoff ? {
        type: 'exponential',
        delay: options.backoff.baseDelayMs,
      } : undefined,
    });
    const now = new Date().toISOString();
    return {
      id: String(bullJob.id ?? options.jobId ?? crypto.randomUUID()),
      name,
      queueName: this.name,
      payload,
      attemptsMade: 0,
      maxAttempts: options.attempts ?? options.backoff?.attempts ?? 5,
      status: 'waiting',
      createdAt: now,
      updatedAt: now,
      correlationId: typeof payload.correlationId === 'string' ? payload.correlationId : undefined,
    };
  }

  getDepth(): Promise<number> {
    return this.queue.count();
  }

  drain(): Promise<void> {
    return this.queue.drain();
  }
}
