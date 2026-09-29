import { DeadLetterQueue } from '../queues/DeadLetterQueue';
import { InMemoryJobQueue } from '../queues/InMemoryJobQueue';
import { JobTelemetry } from '../telemetry/JobTelemetry';
import { BaseWorker, type BaseWorkerOptions } from './BaseWorker';
import {
  AggregateAnalyticsProcessor,
  ChunkDocumentsProcessor,
  CleanPromptLogsProcessor,
  FlushTelemetryProcessor,
  GenerateEmbeddingsProcessor,
  IndexBareActProcessor,
  IndexPatternLibraryProcessor,
  InvalidateCacheProcessor,
  NotificationProcessor,
  RefreshKnowledgeProcessor,
  ScheduleRevisionProcessor,
  UpdateMasteryProcessor,
  UpdateWeaknessesProcessor,
} from '../processors/CoreProcessors';
import type { ProcessorServices } from '../processors/BaseProcessor';

export class GenerateEmbeddingsWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new GenerateEmbeddingsProcessor(services), dlq, telemetry, options); } }
export class ChunkDocumentsWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new ChunkDocumentsProcessor(services), dlq, telemetry, options); } }
export class IndexBareActWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new IndexBareActProcessor(services), dlq, telemetry, options); } }
export class IndexPatternLibraryWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new IndexPatternLibraryProcessor(services), dlq, telemetry, options); } }
export class RefreshKnowledgeWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new RefreshKnowledgeProcessor(services), dlq, telemetry, options); } }
export class UpdateMasteryWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new UpdateMasteryProcessor(services), dlq, telemetry, options); } }
export class UpdateWeaknessesWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new UpdateWeaknessesProcessor(services), dlq, telemetry, options); } }
export class ScheduleRevisionWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new ScheduleRevisionProcessor(services), dlq, telemetry, options); } }
export class AggregateAnalyticsWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new AggregateAnalyticsProcessor(services), dlq, telemetry, options); } }
export class FlushTelemetryWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new FlushTelemetryProcessor(services), dlq, telemetry, options); } }
export class CleanPromptLogsWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new CleanPromptLogsProcessor(services), dlq, telemetry, options); } }
export class InvalidateCacheWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new InvalidateCacheProcessor(services), dlq, telemetry, options); } }
export class NotificationWorker extends BaseWorker { constructor(queue: InMemoryJobQueue, dlq: DeadLetterQueue, services?: ProcessorServices, telemetry?: JobTelemetry, options?: BaseWorkerOptions) { super(queue, new NotificationProcessor(services), dlq, telemetry, options); } }
