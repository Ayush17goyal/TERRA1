import type { JobEnvelope, JobProcessor, SupabaseJobStore } from '../types';

export interface ProcessorServices {
  store?: SupabaseJobStore;
  embeddingService?: { generateBatchEmbeddings(texts: string[]): Promise<number[][]> };
  indexingService?: { indexDocuments(documents: Array<Record<string, unknown>>): Promise<unknown> };
  cacheService?: { invalidate(pattern: string): Promise<void> };
  notificationService?: { send(payload: Record<string, unknown>): Promise<void> };
}

export abstract class BaseProcessor implements JobProcessor {
  abstract readonly name: string;
  protected readonly services: ProcessorServices;

  constructor(services: ProcessorServices = {}) {
    this.services = services;
  }

  abstract process(job: JobEnvelope): Promise<void>;

  protected async persist(table: string, record: Record<string, unknown>): Promise<void> {
    await this.services.store?.insert(table, record);
  }
}
