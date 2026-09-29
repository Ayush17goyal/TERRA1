import type { JobQueueName } from '../types';
import { QueueRegistry } from '../queues/QueueRegistry';

export interface ScheduledJobDefinition {
  name: string;
  queueName: JobQueueName;
  cron: string;
  payload: Record<string, unknown>;
}

export class JobScheduler {
  private readonly registry: QueueRegistry;
  private readonly scheduled: ScheduledJobDefinition[] = [];

  constructor(registry: QueueRegistry) {
    this.registry = registry;
  }

  registerDefaults(): ScheduledJobDefinition[] {
    const defaults: ScheduledJobDefinition[] = [
      { name: 'daily-mastery-recalculation', queueName: 'MasteryUpdateQueue', cron: '0 2 * * *', payload: { scope: 'all_students' } },
      { name: 'weekly-analytics-aggregation', queueName: 'AnalyticsQueue', cron: '0 3 * * 0', payload: { scope: 'weekly' } },
      { name: 'embedding-refresh', queueName: 'EmbeddingQueue', cron: '0 1 * * *', payload: { scope: 'stale_embeddings' } },
      { name: 'knowledge-synchronization', queueName: 'KnowledgeRefreshQueue', cron: '30 1 * * *', payload: { scope: 'approved_sources' } },
      { name: 'cache-cleanup', queueName: 'CacheInvalidationQueue', cron: '0 */6 * * *', payload: { pattern: 'expired:*' } },
      { name: 'orphaned-draft-cleanup', queueName: 'DocumentIndexQueue', cron: '0 4 * * *', payload: { scope: 'orphaned_drafts' } },
      { name: 'prompt-log-archival', queueName: 'PromptLogQueue', cron: '0 5 * * 0', payload: { scope: 'archive_old_logs' } },
    ];
    defaults.forEach((definition) => this.register(definition));
    return defaults;
  }

  register(definition: ScheduledJobDefinition): void {
    if (!this.scheduled.some((existing) => existing.name === definition.name)) {
      this.scheduled.push(definition);
    }
  }

  list(): ScheduledJobDefinition[] {
    return [...this.scheduled];
  }

  async enqueueNow(name: string): Promise<void> {
    const definition = this.scheduled.find((item) => item.name === name);
    if (!definition) throw new Error(`Scheduled job not registered: ${name}`);
    await this.registry.get(definition.queueName).add(definition.name, {
      ...definition.payload,
      scheduledJob: definition.name,
      scheduledAt: new Date().toISOString(),
    });
  }
}
