import { BaseRule } from './BaseRule';
import type { RuleResult, ValidationContext } from '../types';

export class BehaviourComplianceCheck extends BaseRule {
  readonly id = 'behaviour_compliance';
  readonly name = 'Behaviour Compliance Check';

  check(context: ValidationContext): RuleResult {
    if (/stupid|obvious|lazy|nonsense|you clearly/i.test(context.text)) {
      return this.fail('ERROR', 'Response uses dismissive or inappropriate teaching language.', { repairable: false });
    }
    if (/excellent|perfect|flawless/i.test(context.text) && /unclear|vague|missing|incorrect|problem/i.test(context.text)) {
      return this.fail('WARNING', 'Response may overpraise while identifying significant defects.', { repairable: false });
    }
    return this.pass();
  }
}
