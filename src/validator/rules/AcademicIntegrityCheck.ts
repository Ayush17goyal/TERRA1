import { BaseRule } from './BaseRule';
import type { RuleResult, ValidationContext } from '../types';

export class AcademicIntegrityCheck extends BaseRule {
  readonly id = 'academic_integrity';
  readonly name = 'Academic Integrity Check';

  check(context: ValidationContext): RuleResult {
    if (/submit this as your answer|copy this into your assignment|do not mention AI|hide AI/i.test(context.text)) {
      return this.fail('BLOCKING', 'Response encourages academic misconduct or undisclosed submission.', { repairable: false });
    }
    return this.pass();
  }
}
