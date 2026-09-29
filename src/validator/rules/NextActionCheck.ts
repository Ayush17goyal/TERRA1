import { BaseRule } from './BaseRule';
import { hasAnyHeading } from '../checks/TextSignals';
import type { RuleResult, ValidationContext } from '../types';

export class NextActionCheck extends BaseRule {
  readonly id = 'next_action';
  readonly name = 'Next Action Check';

  check(context: ValidationContext): RuleResult {
    if (hasAnyHeading(context.text, ['Next action', 'Next step', 'Your task']) || /now\s+(revise|draft|answer|identify|submit|compare|try)/i.test(context.text)) {
      return this.pass();
    }
    return this.fail('WARNING', 'Response does not include a concrete next student action.', { repairable: true });
  }
}
