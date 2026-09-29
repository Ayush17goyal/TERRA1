import { BaseRule } from './BaseRule';
import { countMatches } from '../checks/TextSignals';
import type { RuleResult, ValidationContext } from '../types';

export class NoGhostwritingCheck extends BaseRule {
  readonly id = 'no_ghostwriting';
  readonly name = 'No Ghostwriting Check';

  check(context: ValidationContext): RuleResult {
    const sectionCount = countMatches(context.text, /(^|\n)\s*(section\s+\d+|\d+\.)\s+/gi);
    const draftingRequest = ['drafting', 'assessment', 'quiz'].includes(context.packet.intent);
    if (draftingRequest && sectionCount >= 4 && !/your attempt|revise|student/i.test(context.text)) {
      return this.fail('BLOCKING', 'Response appears to author multiple statutory provisions for the student.', { repairable: false });
    }
    return this.pass();
  }
}
