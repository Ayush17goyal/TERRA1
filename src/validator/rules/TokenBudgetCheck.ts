import { BaseRule } from './BaseRule';
import type { RuleResult, ValidationContext } from '../types';

export class TokenBudgetCheck extends BaseRule {
  readonly id = 'token_budget';
  readonly name = 'Token Budget Check';

  check(context: ValidationContext): RuleResult {
    const maxOutput = context.packet.maxOutputTokens;
    if (!maxOutput) return this.pass();
    const estimated = Math.ceil(context.text.length / 4);
    if (estimated <= maxOutput * 1.1) return this.pass();
    return this.fail('ERROR', 'Response exceeds configured output token budget.', { evidence: `${estimated}/${maxOutput}`, repairable: false });
  }
}
