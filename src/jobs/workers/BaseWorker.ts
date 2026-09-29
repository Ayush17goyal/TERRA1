import type { JobEnvelope, JobProcessor, WorkerRuntime } from '../types';
import { DeadLetterQueue } from '../queues/DeadLetterQueue';
import { InMemoryJobQueue } from '../queues/InMemoryJobQueue';
import { RetryPolicyManager, defaultRetryPolicy } from '../retries/RetryPolicy';
import { JobTelemetry } from '../telemetry/JobTelemetry';

export interface BaseWorkerOptions {
  concurrency?: number;
}

export class BaseWorker implements WorkerRuntime {
  private running = false;
  private readonly retryManager = new RetryPolicyManager();
  private readonly queue: InMemoryJobQueue;
  private readonly processor: JobProcessor;
  private readonly deadLetterQueue: DeadLetterQueue;
  private readonly telemetry: JobTelemetry;
  private readonly concurrency: number;

  constructor(
    queue: InMemoryJobQueue,
    processor: JobProcessor,
    deadLetterQueue: DeadLetterQueue,
    telemetry: JobTelemetry = new JobTelemetry(),
    options: BaseWorkerOptions = {}
  ) {
    this.queue = queue;
    this.processor = processor;
    this.deadLetterQueue = deadLetterQueue;
    this.telemetry = telemetry;
    this.concurrency = Math.max(1, Math.min(options.concurrency ?? 1, 32));
  }

  async start(): Promise<void> {
    this.running = true;
    await Promise.all(Array.from({ length: this.concurrency }, () => this.loop()));
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      const job = await this.queue.next();
      if (!job) break;
      await this.runJob(job);
    }
  }

  private async runJob(job: JobEnvelope): Promise<void> {
    const started = Date.now();
    try {
      await this.processor.process(job);
      await this.queue.complete(job.id);
      this.telemetry.recordCompletion(job.queueName, this.processor.name, Date.now() - started);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      await this.queue.fail(job.id);
      this.telemetry.recordFailure(job.queueName, this.processor.name, job.attemptsMade);
      if (this.retryManager.shouldRetry(defaultRetryPolicy, job.attemptsMade)) {
        await new Promise((resolve) => setTimeout(resolve, this.retryManager.nextDelay(defaultRetryPolicy, job.attemptsMade)));
        await this.queue.requeue(job.id);
      } else {
        await this.deadLetterQueue.add(job, normalized);
      }
    }
  }
}