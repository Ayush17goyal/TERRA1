import { BaseRule } from './BaseRule';
import { countMatches } from '../checks/TextSignals';
import type { RuleResult, ValidationContext } from '../types';

export class BareActBoundaryCheck extends BaseRule {
  readonly id = 'bare_act_boundary';
  readonly name = 'Bare Act Boundary Check';

  check(context: ValidationContext): RuleResult {
    const fullGenerationRisk = context.packet.promptRequest.safety?.riskFlags?.includes('complete_bare_act_request');
    const sectionCount = countMatches(context.text, /(^|\n)\s*(chapter\s+[ivx\d]+|section\s+\d+|\d+\.)\s+/gi);
    if (fullGenerationRisk && sectionCount >= 3) {
      return this.fail('BLOCKING', 'Response appears to generate Bare Act structure after a full-generation risk flag.', { repairable: false });
    }
    if (/complete bare act|full act drafted below|enactable act/i.test(context.text)) {
      return this.fail('BLOCKING', 'Response presents or frames itself as a complete Bare Act.', { repairable: false });
    }
    return this.pass();
  }
}
