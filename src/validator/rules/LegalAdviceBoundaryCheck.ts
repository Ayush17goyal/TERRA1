import { BaseRule } from './BaseRule';
import type { RuleResult, ValidationContext } from '../types';

export class LegalAdviceBoundaryCheck extends BaseRule {
  readonly id = 'legal_advice_boundary';
  readonly name = 'Legal Advice Boundary Check';

  check(context: ValidationContext): RuleResult {
    if (/\byou should sue\b|\byou are liable\b|\bthis is legal\b|\bthis is illegal\b|\bguaranteed valid\b|\bwill win\b/i.test(context.text)) {
      return this.fail('BLOCKING', 'Response appears to give legal advice or legal conclusion.', { repairable: false });
    }
    return this.pass();
  }
}
