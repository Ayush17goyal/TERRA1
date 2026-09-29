import type { LoggerLike } from '../../llm/types';
import type { DocumentPipelineTelemetryRecord } from '../types';

class ConsoleDocumentLogger implements LoggerLike {
  info(data: unknown, message?: string): void { console.info(message ?? 'documents.info', data); }
  warn(data: unknown, message?: string): void { console.warn(message ?? 'documents.warn', data); }
  error(data: unknown, message?: string): void { console.error(message ?? 'documents.error', data); }
}

export class DocumentTelemetry {
  private readonly logger: LoggerLike;

  constructor(logger: LoggerLike = new ConsoleDocumentLogger()) {
    this.logger = logger;
  }

  record(record: DocumentPipelineTelemetryRecord): void {
    this.logger.info(record, 'document.pipeline');
  }
}
