import { BaseRule } from './BaseRule';
import type { RuleResult, ValidationContext } from '../types';

export class LearningObjectiveCheck extends BaseRule {
  readonly id = 'learning_objective';
  readonly name = 'Learning Objective Check';

  check(context: ValidationContext): RuleResult {
    const objective = context.packet.promptRequest.curriculum?.learningOutcomes?.[0] ?? context.packet.promptRequest.curriculum?.lessonTitle;
    if (!objective) return this.pass();
    const objectiveTerms = String(objective).toLowerCase().split(/\W+/).filter((term) => term.length > 4);
    if (objectiveTerms.length === 0) return this.pass();
    const hits = objectiveTerms.filter((term) => context.text.toLowerCase().includes(term)).length;
    if (hits > 0) return this.pass();
    return this.fail('WARNING', 'Response may not address the active learning objective.', { repairable: false });
  }
}
