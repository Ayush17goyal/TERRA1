import { BaseRule } from './BaseRule';
import type { RuleResult, ValidationContext } from '../types';

export class AssessmentBoundaryCheck extends BaseRule {
  readonly id = 'assessment_boundary';
  readonly name = 'Assessment Boundary Check';

  check(context: ValidationContext): RuleResult {
    const assessmentMode = context.packet.promptRequest.safety?.assessmentMode || context.packet.intent === 'assessment';
    if (!assessmentMode) return this.pass();
    if (/model answer|final answer|submit this|copy this|complete answer/i.test(context.text)) {
      return this.fail('BLOCKING', 'Assessment response appears to provide a complete answer or submission-ready text.', { repairable: false });
    }
    return this.pass();
  }
}
