import type { JobQueue, JobQueueName } from '../types';
import { InMemoryJobQueue } from './InMemoryJobQueue';

export const queueNames: JobQueueName[] = [
  'EmbeddingQueue',
  'DocumentIndexQueue',
  'KnowledgeRefreshQueue',
  'MasteryUpdateQueue',
  'WeaknessAnalysisQueue',
  'RevisionSchedulingQueue',
  'PromptLogQueue',
  'TelemetryQueue',
  'AnalyticsQueue',
  'CacheInvalidationQueue',
  'NotificationQueue',
];

export class QueueRegistry {
  private readonly queues = new Map<JobQueueName, JobQueue>();

  constructor(queues?: Partial<Record<JobQueueName, JobQueue>>) {
    for (const name of queueNames) {
      this.queues.set(name, queues?.[name] ?? new InMemoryJobQueue(name));
    }
  }

  get<TPayload extends Record<string, unknown> = Record<string, unknown>>(name: JobQueueName): JobQueue<TPayload> {
    const queue = this.queues.get(name);
    if (!queue) throw new Error(`Queue not registered: ${name}`);
    return queue as JobQueue<TPayload>;
  }

  all(): JobQueue[] {
    return [...this.queues.values()];
  }
}
