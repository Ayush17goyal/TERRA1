import type { JobEnvelope } from '../types';
import { BaseProcessor } from './BaseProcessor';

export class GenerateEmbeddingsProcessor extends BaseProcessor {
  readonly name = 'GenerateEmbeddingsWorker';
  async process(job: JobEnvelope): Promise<void> {
    const texts = Array.isArray(job.payload.texts) ? job.payload.texts.map(String) : [String(job.payload.text ?? '')].filter(Boolean);
    if (texts.length === 0) throw new Error('Embedding job requires text or texts.');
    const embeddings = await this.services.embeddingService?.generateBatchEmbeddings(texts);
    await this.persist('mentor_embedding_jobs', { job_id: job.id, payload: job.payload, embeddings_count: embeddings?.length ?? 0, completed_at: new Date().toISOString() });
  }
}

export class ChunkDocumentsProcessor extends BaseProcessor {
  readonly name = 'ChunkDocumentsWorker';
  async process(job: JobEnvelope): Promise<void> {
    await this.persist('mentor_document_chunks', { job_id: job.id, payload: job.payload, processed_at: new Date().toISOString() });
  }
}

export class IndexBareActProcessor extends BaseProcessor {
  readonly name = 'IndexBareActWorker';
  async process(job: JobEnvelope): Promise<void> {
    await this.services.indexingService?.indexDocuments([job.payload]);
    await this.persist('mentor_bare_act_index_jobs', { job_id: job.id, payload: job.payload, indexed_at: new Date().toISOString() });
  }
}

export class IndexPatternLibraryProcessor extends BaseProcessor {
  readonly name = 'IndexPatternLibraryWorker';
  async process(job: JobEnvelope): Promise<void> {
    const documents = Array.isArray(job.payload.documents) ? job.payload.documents as Array<Record<string, unknown>> : [job.payload];
    await this.services.indexingService?.indexDocuments(documents);
    await this.persist('mentor_pattern_index_jobs', { job_id: job.id, count: documents.length, indexed_at: new Date().toISOString() });
  }
}

export class RefreshKnowledgeProcessor extends BaseProcessor {
  readonly name = 'RefreshKnowledgeWorker';
  async process(job: JobEnvelope): Promise<void> {
    await this.persist('mentor_knowledge_refresh_jobs', { job_id: job.id, payload: job.payload, refreshed_at: new Date().toISOString() });
  }
}

export class UpdateMasteryProcessor extends BaseProcessor {
  readonly name = 'UpdateMasteryWorker';
  async process(job: JobEnvelope): Promise<void> {
    await this.persist('mentor_mastery_updates', { job_id: job.id, payload: job.payload, updated_at: new Date().toISOString() });
  }
}

export class UpdateWeaknessesProcessor extends BaseProcessor {
  readonly name = 'UpdateWeaknessesWorker';
  async process(job: JobEnvelope): Promise<void> {
    await this.persist('mentor_weakness_updates', { job_id: job.id, payload: job.payload, updated_at: new Date().toISOString() });
  }
}

export class ScheduleRevisionProcessor extends BaseProcessor {
  readonly name = 'ScheduleRevisionWorker';
  async process(job: JobEnvelope): Promise<void> {
    await this.persist('mentor_revision_schedule', { job_id: job.id, payload: job.payload, scheduled_at: new Date().toISOString() });
  }
}

export class AggregateAnalyticsProcessor extends BaseProcessor {
  readonly name = 'AggregateAnalyticsWorker';
  async process(job: JobEnvelope): Promise<void> {
    await this.persist('mentor_analytics_aggregates', { job_id: job.id, payload: job.payload, aggregated_at: new Date().toISOString() });
  }
}

export class FlushTelemetryProcessor extends BaseProcessor {
  readonly name = 'FlushTelemetryWorker';
  async process(job: JobEnvelope): Promise<void> {
    await this.persist('mentor_telemetry_events', { job_id: job.id, payload: job.payload, recorded_at: new Date().toISOString() });
  }
}

export class CleanPromptLogsProcessor extends BaseProcessor {
  readonly name = 'CleanPromptLogsWorker';
  async process(job: JobEnvelope): Promise<void> {
    await this.persist('mentor_prompt_log_cleanup', { job_id: job.id, payload: job.payload, cleaned_at: new Date().toISOString() });
  }
}

export class InvalidateCacheProcessor extends BaseProcessor {
  readonly name = 'InvalidateCacheWorker';
  async process(job: JobEnvelope): Promise<void> {
    const pattern = String(job.payload.pattern ?? job.payload.cacheKey ?? '*');
    await this.services.cacheService?.invalidate(pattern);
    await this.persist('mentor_cache_invalidations', { job_id: job.id, pattern, invalidated_at: new Date().toISOString() });
  }
}

export class NotificationProcessor extends BaseProcessor {
  readonly name = 'NotificationWorker';
  async process(job: JobEnvelope): Promise<void> {
    await this.services.notificationService?.send(job.payload);
    await this.persist('mentor_notifications', { job_id: job.id, payload: job.payload, sent_at: new Date().toISOString() });
  }
}
