import { BaseRule } from './BaseRule';
import { hasAnyHeading } from '../checks/TextSignals';
import type { RuleResult, ValidationContext } from '../types';

export class TeachingStrategyCheck extends BaseRule {
  readonly id = 'teaching_strategy';
  readonly name = 'Teaching Strategy Check';

  check(context: ValidationContext): RuleResult {
    const strategy = context.packet.teachingStrategy;
    const text = context.text;
    if (strategy === 'review' && !hasAnyHeading(text, ['Strengths', 'Weaknesses', 'Drafting issues'])) {
      return this.fail('ERROR', 'Review strategy requires structured draft-review feedback.', { repairable: true });
    }
    if (strategy === 'hint' && /model answer|final answer|complete answer/i.test(text)) {
      return this.fail('ERROR', 'Hint strategy appears to reveal a model or final answer.', { repairable: false });
    }
    if (strategy === 'safe_redirect' && !/cannot|can't|instead|educational|I can help/i.test(text)) {
      return this.fail('ERROR', 'Safe redirect strategy did not clearly redirect the unsafe request.', { repairable: false });
    }
    return this.pass();
  }
}
