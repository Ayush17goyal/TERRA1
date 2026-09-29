import type { GuardrailRule, RuleResult, ValidationContext, ValidationViolation, ViolationSeverity } from '../types';

export abstract class BaseRule implements GuardrailRule {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract check(context: ValidationContext): RuleResult;

  protected pass(): RuleResult {
    return { ruleId: this.id, ruleName: this.name, passed: true, violations: [] };
  }

  protected fail(severity: ViolationSeverity, message: string, options: { evidence?: string; repairable?: boolean } = {}): RuleResult {
    return {
      ruleId: this.id,
      ruleName: this.name,
      passed: false,
      violations: [this.violation(severity, message, options)],
    };
  }

  protected violation(severity: ViolationSeverity, message: string, options: { evidence?: string; repairable?: boolean } = {}): ValidationViolation {
    return {
      ruleId: this.id,
      ruleName: this.name,
      severity,
      message,
      evidence: options.evidence,
      repairable: options.repairable ?? false,
    };
  }
}
