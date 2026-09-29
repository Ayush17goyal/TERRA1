import { BaseRule } from './BaseRule';
import type { RuleResult, ValidationContext } from '../types';

export class ConsistencyCheck extends BaseRule {
  readonly id = 'consistency';
  readonly name = 'Consistency Check';

  check(context: ValidationContext): RuleResult {
    const previous = context.packet.promptRequest.draft?.previousFeedback ?? context.packet.promptRequest.student?.previousFeedbackSummary;
    if (!previous) return this.pass();
    if (/missing duty-holder/i.test(previous) && !/duty-holder|who is bound|actor/i.test(context.text)) {
      return this.fail('WARNING', 'Response does not remain consistent with prior duty-holder feedback.', { repairable: false });
    }
    return this.pass();
  }
}
