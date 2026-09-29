import type { JobEnvelope, JobOptions, JobQueue, JobQueueName } from '../types';
import { parseJobEnvelope } from '../validators/schemas';
import { defaultRetryPolicy } from '../retries/RetryPolicy';

export class InMemoryJobQueue<TPayload extends Record<string, unknown> = Record<string, unknown>> implements JobQueue<TPayload> {
  readonly name: JobQueueName;
  private readonly jobs: Array<JobEnvelope<TPayload>> = [];

  constructor(name: JobQueueName) {
    this.name = name;
  }

  async add(name: string, payload: TPayload, options: JobOptions = {}): Promise<JobEnvelope<TPayload>> {
    const now = new Date().toISOString();
    const job: JobEnvelope<TPayload> = {
      id: options.jobId ?? crypto.randomUUID(),
      name,
      queueName: this.name,
      payload,
      attemptsMade: 0,
      maxAttempts: options.attempts ?? options.backoff?.attempts ?? defaultRetryPolicy.attempts,
      status: 'waiting',
      createdAt: now,
      updatedAt: now,
      correlationId: typeof payload.correlationId === 'string' ? payload.correlationId : undefined,
    };
    const parsed = parseJobEnvelope(job);
    this.jobs.push(parsed);
    return parsed;
  }

  async getDepth(): Promise<number> {
    return this.jobs.filter((job) => job.status === 'waiting').length;
  }

  async drain(): Promise<void> {
    this.jobs.length = 0;
  }

  async next(): Promise<JobEnvelope<TPayload> | undefined> {
    const job = this.jobs.find((candidate) => candidate.status === 'waiting');
    if (!job) return undefined;
    job.status = 'active';
    job.updatedAt = new Date().toISOString();
    return job;
  }

  async complete(jobId: string): Promise<void> {
    const job = this.jobs.find((candidate) => candidate.id === jobId);
    if (job) {
      job.status = 'completed';
      job.updatedAt = new Date().toISOString();
    }
  }

  async fail(jobId: string): Promise<void> {
    const job = this.jobs.find((candidate) => candidate.id === jobId);
    if (job) {
      job.status = 'failed';
      job.attemptsMade += 1;
      job.updatedAt = new Date().toISOString();
    }
  }

  async requeue(jobId: string): Promise<void> {
    const job = this.jobs.find((candidate) => candidate.id === jobId);
    if (job) {
      job.status = 'waiting';
      job.updatedAt = new Date().toISOString();
    }
  }
}
