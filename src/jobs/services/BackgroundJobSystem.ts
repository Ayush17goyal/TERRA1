import { EventBus } from '../events/EventBus';
import { DeadLetterQueue } from '../queues/DeadLetterQueue';
import { InMemoryJobQueue } from '../queues/InMemoryJobQueue';
import { QueueRegistry } from '../queues/QueueRegistry';
import { JobScheduler } from '../schedulers/JobScheduler';
import { JobTelemetry } from '../telemetry/JobTelemetry';
import type { SupabaseJobStore, WorkerRuntime } from '../types';
import { JobDispatchService } from './JobDispatchService';
import type { ProcessorServices } from '../processors/BaseProcessor';
import {
  AggregateAnalyticsWorker,
  ChunkDocumentsWorker,
  CleanPromptLogsWorker,
  FlushTelemetryWorker,
  GenerateEmbeddingsWorker,
  IndexBareActWorker,
  IndexPatternLibraryWorker,
  InvalidateCacheWorker,
  NotificationWorker,
  RefreshKnowledgeWorker,
  ScheduleRevisionWorker,
  UpdateMasteryWorker,
  UpdateWeaknessesWorker,
} from '../workers/Workers';

export interface BackgroundJobSystemOptions {
  registry?: QueueRegistry;
  eventBus?: EventBus;
  store?: SupabaseJobStore;
  processorServices?: ProcessorServices;
  telemetry?: JobTelemetry;
  workerConcurrency?: Partial<Record<string, number>>;
}

export class BackgroundJobSystem {
  readonly registry: QueueRegistry;
  readonly eventBus: EventBus;
  readonly scheduler: JobScheduler;
  readonly deadLetterQueue: DeadLetterQueue;
  private readonly dispatchService: JobDispatchService;
  private readonly telemetry: JobTelemetry;
  private readonly workers: WorkerRuntime[];

  constructor(options: BackgroundJobSystemOptions = {}) {
    this.registry = options.registry ?? new QueueRegistry();
    this.eventBus = options.eventBus ?? new EventBus();
    this.telemetry = options.telemetry ?? new JobTelemetry();
    this.deadLetterQueue = new DeadLetterQueue(options.store);
    this.dispatchService = new JobDispatchService(this.registry);
    this.scheduler = new JobScheduler(this.registry);
    this.scheduler.registerDefaults();
    this.eventBus.onAny((event) => this.dispatchService.dispatchEvent(event));
    this.workers = this.buildWorkers(options.processorServices, options.workerConcurrency ?? {});
  }

  async start(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.start()));
    await this.recordDepths();
  }

  async stop(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.stop()));
  }

  private buildWorkers(services?: ProcessorServices, concurrency: Partial<Record<string, number>> = {}): WorkerRuntime[] {
    const dlq = this.deadLetterQueue;
    const telemetry = this.telemetry;
    const get = (name: Parameters<QueueRegistry['get']>[0]) => this.registry.get(name) as InMemoryJobQueue;
    return [
      new GenerateEmbeddingsWorker(get('EmbeddingQueue'), dlq, services, telemetry, { concurrency: concurrency.EmbeddingQueue ?? 4 }),
      new ChunkDocumentsWorker(get('DocumentIndexQueue'), dlq, services, telemetry, { concurrency: concurrency.DocumentIndexQueue ?? 3 }),
      new IndexBareActWorker(get('DocumentIndexQueue'), dlq, services, telemetry, { concurrency: concurrency.DocumentIndexQueue ?? 3 }),
      new IndexPatternLibraryWorker(get('DocumentIndexQueue'), dlq, services, telemetry, { concurrency: concurrency.DocumentIndexQueue ?? 3 }),
      new RefreshKnowledgeWorker(get('KnowledgeRefreshQueue'), dlq, services, telemetry),
      new UpdateMasteryWorker(get('MasteryUpdateQueue'), dlq, services, telemetry),
      new UpdateWeaknessesWorker(get('WeaknessAnalysisQueue'), dlq, services, telemetry),
      new ScheduleRevisionWorker(get('RevisionSchedulingQueue'), dlq, services, telemetry),
      new AggregateAnalyticsWorker(get('AnalyticsQueue'), dlq, services, telemetry, { concurrency: concurrency.AnalyticsQueue ?? 2 }),
      new FlushTelemetryWorker(get('TelemetryQueue'), dlq, services, telemetry, { concurrency: concurrency.TelemetryQueue ?? 2 }),
      new CleanPromptLogsWorker(get('PromptLogQueue'), dlq, services, telemetry),
      new InvalidateCacheWorker(get('CacheInvalidationQueue'), dlq, services, telemetry),
      new NotificationWorker(get('NotificationQueue'), dlq, services, telemetry),
    ];
  }

  private async recordDepths(): Promise<void> {
    for (const queue of this.registry.all()) {
      this.telemetry.recordDepth(queue.name, await queue.getDepth());
    }
  }
}
