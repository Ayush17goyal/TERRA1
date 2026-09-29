import type { JobEnvelope, JobFailureRecord, SupabaseJobStore } from '../types';

export class DeadLetterQueue {
  private readonly failures: JobFailureRecord[] = [];
  private readonly store?: SupabaseJobStore;

  constructor(store?: SupabaseJobStore) {
    this.store = store;
  }

  async add(job: JobEnvelope, error: Error): Promise<void> {
    const record: JobFailureRecord = {
      job: { ...job, status: 'dead_lettered', updatedAt: new Date().toISOString() },
      error: error.message,
      failedAt: new Date().toISOString(),
    };
    this.failures.push(record);
    await this.store?.insert('mentor_dead_letter_jobs', {
      job_id: job.id,
      queue_name: job.queueName,
      job_name: job.name,
      payload: job.payload,
      attempts_made: job.attemptsMade,
      error: error.message,
      failed_at: record.failedAt,
    });
  }

  list(): JobFailureRecord[] {
    return [...this.failures];
  }
}
