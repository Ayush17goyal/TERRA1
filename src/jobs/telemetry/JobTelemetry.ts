import type { LoggerLike } from '../../llm/types';
import type { QueueTelemetryRecord } from '../types';

class ConsoleJobLogger implements LoggerLike {
  info(data: unknown, message?: string): void { console.info(message ?? 'jobs.info', data); }
  warn(data: unknown, message?: string): void { console.warn(message ?? 'jobs.warn', data); }
  error(data: unknown, message?: string): void { console.error(message ?? 'jobs.error', data); }
  debug(data: unknown, message?: string): void { console.debug(message ?? 'jobs.debug', data); }
}

export class JobTelemetry {
  private readonly logger: LoggerLike;
  private completed = 0;
  private failed = 0;
  private totalDuration = 0;

  constructor(logger: LoggerLike = new ConsoleJobLogger()) {
    this.logger = logger;
  }

  record(record: QueueTelemetryRecord): void {
    this.logger.info(record, 'job.telemetry');
  }

  recordCompletion(queueName: QueueTelemetryRecord['queueName'], workerName: string, durationMs: number): void {
    this.completed += 1;
    this.totalDuration += durationMs;
    this.record({
      queueName,
      workerName,
      workerDurationMs: durationMs,
      throughput: this.completed,
      averageExecutionTimeMs: this.totalDuration / Math.max(1, this.completed),
      failureRate: this.failed / Math.max(1, this.completed + this.failed),
    });
  }

  recordFailure(queueName: QueueTelemetryRecord['queueName'], workerName: string, retryCount: number): void {
    this.failed += 1;
    this.record({
      queueName,
      workerName,
      retryCount,
      failureRate: this.failed / Math.max(1, this.completed + this.failed),
    });
  }

  recordDepth(queueName: QueueTelemetryRecord['queueName'], queueDepth: number): void {
    this.record({ queueName, queueDepth });
  }
}
