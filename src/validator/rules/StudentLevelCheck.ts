import { BaseRule } from './BaseRule';
import { wordCount } from '../checks/TextSignals';
import type { RuleResult, ValidationContext } from '../types';

export class StudentLevelCheck extends BaseRule {
  readonly id = 'student_level';
  readonly name = 'Student Level Check';

  check(context: ValidationContext): RuleResult {
    const level = context.packet.promptRequest.student?.level;
    if (level === 'beginner' && wordCount(context.text) > 700) {
      return this.fail('WARNING', 'Beginner response is likely too long and cognitively heavy.', { repairable: false });
    }
    if (level === 'beginner' && /non obstante|excessive delegation|validation clause|retrospective operation/i.test(context.text) && context.packet.intent === 'learning') {
      return this.fail('WARNING', 'Beginner response may introduce advanced concepts prematurely.', { repairable: false });
    }
    return this.pass();
  }
}
