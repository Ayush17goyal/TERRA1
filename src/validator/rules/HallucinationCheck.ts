import { BaseRule } from './BaseRule';
import type { RuleResult, ValidationContext } from '../types';

export class HallucinationCheck extends BaseRule {
  readonly id = 'hallucination';
  readonly name = 'Hallucination Check';

  check(context: ValidationContext): RuleResult {
    if (/\b[A-Z][A-Za-z\s]+Act,\s*\d{4}\b/.test(context.text) && context.packet.promptRequest.safety?.sourceGroundingStatus !== 'grounded') {
      return this.fail('ERROR', 'Response cites statute-like authority without confirmed source grounding.', { repairable: false });
    }
    if (/\b(section|article)\s+\d+[A-Z]?\s+of\s+the\s+[A-Z][A-Za-z\s]+Act/i.test(context.text) && context.packet.promptRequest.safety?.sourceGroundingStatus !== 'grounded') {
      return this.fail('ERROR', 'Response makes specific statutory citation claims without grounding.', { repairable: false });
    }
    return this.pass();
  }
}
