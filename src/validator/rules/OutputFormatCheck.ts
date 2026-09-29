import { BaseRule } from './BaseRule';
import { hasHeading } from '../checks/TextSignals';
import type { RuleResult, ValidationContext } from '../types';

export class OutputFormatCheck extends BaseRule {
  readonly id = 'output_format';
  readonly name = 'Output Format Check';

  check(context: ValidationContext): RuleResult {
    const required = context.packet.promptRequest.output?.requiredSections ?? [];
    const missing = required.filter((heading) => !hasHeading(context.text, heading));
    if (missing.length === 0) return this.pass();
    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: false,
      violations: missing.map((heading) => this.violation('WARNING', `Required output section is missing: ${heading}.`, { evidence: heading, repairable: true })),
    };
  }
}
