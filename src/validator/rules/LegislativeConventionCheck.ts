import { BaseRule } from './BaseRule';
import type { RuleResult, ValidationContext } from '../types';

export class LegislativeConventionCheck extends BaseRule {
  readonly id = 'legislative_convention';
  readonly name = 'Legislative Convention Check';

  check(context: ValidationContext): RuleResult {
    if (/\balways\b.*\b(Parliament|statutes?|Acts?)\b|\bnever\b.*\b(Parliament|statutes?|Acts?)\b/i.test(context.text)) {
      return this.fail('WARNING', 'Response states an absolute legislative convention that may need qualification.', { repairable: false });
    }
    return this.pass();
  }
}
