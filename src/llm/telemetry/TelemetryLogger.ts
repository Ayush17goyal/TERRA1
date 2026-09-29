import type { LLMExecutionRecord, LoggerLike, TelemetrySink, TelemetrySpan } from '../types';

class NoopSpan implements TelemetrySpan {
  setAttribute(): void {}
  recordException(): void {}
  end(): void {}
}

class NoopTelemetrySink implements TelemetrySink {
  startSpan(): TelemetrySpan {
    return new NoopSpan();
  }

  recordMetric(): void {}
}

class ConsoleLogger implements LoggerLike {
  info(data: unknown, message?: string): void { console.info(message ?? 'llm.info', data); }
  warn(data: unknown, message?: string): void { console.warn(message ?? 'llm.warn', data); }
  error(data: unknown, message?: string): void { console.error(message ?? 'llm.error', data); }
  debug(data: unknown, message?: string): void { console.debug(message ?? 'llm.debug', data); }
}

export class TelemetryLogger {
  private readonly logger: LoggerLike;
  private readonly telemetry: TelemetrySink;

  constructor(options: { logger?: LoggerLike; telemetry?: TelemetrySink } = {}) {
    this.logger = options.logger ?? new ConsoleLogger();
    this.telemetry = options.telemetry ?? new NoopTelemetrySink();
  }

  startSpan(name: string, attributes?: Record<string, unknown>): TelemetrySpan {
    return this.telemetry.startSpan(name, attributes);
  }

  logExecution(record: LLMExecutionRecord): void {
    this.logger.info(record, 'llm.execution');
    this.telemetry.recordMetric('llm.latency_ms', record.latencyMs, { model: record.model, intent: record.intent });
    this.telemetry.recordMetric('llm.cost_usd', record.cost.actualCostUsd ?? record.cost.estimatedCostUsd, { model: record.model });
    this.telemetry.recordMetric('llm.retry_count', record.retryCount, { model: record.model });
  }

  logError(error: Error, attributes?: Record<string, unknown>): void {
    this.logger.error({ error: error.message, stack: error.stack, ...attributes }, 'llm.error');
  }

  logStreamEvent(type: string, attributes?: Record<string, unknown>): void {
    this.logger.debug?.({ type, ...attributes }, 'llm.stream_event');
  }
}
