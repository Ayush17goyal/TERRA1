import { BaseRule } from './BaseRule';
import type { RuleResult, ValidationContext } from '../types';

export class EducationalValueCheck extends BaseRule {
  readonly id = 'educational_value';
  readonly name = 'Educational Value Check';

  check(context: ValidationContext): RuleResult {
    if (/why|because|principle|drafting|legal effect|matters|reason|revise/i.test(context.text)) return this.pass();
    return this.fail('ERROR', 'Response lacks visible educational reasoning or drafting principle explanation.', { repairable: false });
  }
}
