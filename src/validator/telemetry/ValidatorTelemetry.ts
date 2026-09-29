import type { LoggerLike } from '../../llm/types';
import type { ValidationTelemetryRecord } from '../types';

class ConsoleValidatorLogger implements LoggerLike {
  info(data: unknown, message?: string): void { console.info(message ?? 'validator.info', data); }
  warn(data: unknown, message?: string): void { console.warn(message ?? 'validator.warn', data); }
  error(data: unknown, message?: string): void { console.error(message ?? 'validator.error', data); }
  debug(data: unknown, message?: string): void { console.debug(message ?? 'validator.debug', data); }
}

export class ValidatorTelemetry {
  private readonly logger: LoggerLike;
  private total = 0;
  private approved = 0;
  private regenerations = 0;
  private repairs = 0;

  constructor(logger: LoggerLike = new ConsoleValidatorLogger()) {
    this.logger = logger;
  }

  record(record: ValidationTelemetryRecord): void {
    this.total += 1;
    if (record.approved) this.approved += 1;
    if (record.regenerationRequested) this.regenerations += 1;
    if (record.repairActions.length > 0) this.repairs += 1;

    this.logger.info({
      ...record,
      approvalRate: this.total > 0 ? this.approved / this.total : 0,
      repairRate: this.total > 0 ? this.repairs / this.total : 0,
      regenerationRate: this.total > 0 ? this.regenerations / this.total : 0,
    }, 'educational_response_validation');
  }
}
