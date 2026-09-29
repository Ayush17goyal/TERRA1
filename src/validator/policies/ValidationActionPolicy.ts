import type { ValidationViolation, ValidatorAction } from '../types';

const severityRank = {
  INFO: 0,
  WARNING: 1,
  ERROR: 2,
  BLOCKING: 3,
};

export class ValidationActionPolicy {
  decide(violations: ValidationViolation[]): ValidatorAction {
    if (violations.length === 0) return 'approve';
    if (violations.some((violation) => violation.severity === 'BLOCKING')) return 'block_response';
    if (violations.some((violation) => violation.severity === 'ERROR' && !violation.repairable)) return 'request_regeneration';
    if (violations.every((violation) => violation.repairable && severityRank[violation.severity] <= severityRank.WARNING)) return 'repair';
    if (violations.some((violation) => violation.repairable) && !violations.some((violation) => violation.severity === 'ERROR')) return 'repair';
    return 'request_regeneration';
  }
}
