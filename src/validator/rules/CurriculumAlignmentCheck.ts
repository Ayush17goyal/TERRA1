import { BaseRule } from './BaseRule';
import type { RuleResult, ValidationContext } from '../types';

export class CurriculumAlignmentCheck extends BaseRule {
  readonly id = 'curriculum_alignment';
  readonly name = 'Curriculum Alignment Check';

  check(context: ValidationContext): RuleResult {
    const curriculum = context.packet.promptRequest.curriculum;
    if (!curriculum?.moduleTitle && !curriculum?.lessonTitle) return this.pass();
    const expected = [curriculum.moduleTitle, curriculum.lessonTitle].filter(Boolean).map((value) => String(value).toLowerCase());
    const text = context.text.toLowerCase();
    if (expected.some((value) => text.includes(value))) return this.pass();
    if (context.packet.intent === 'review' || context.packet.intent === 'revision') return this.pass();
    return this.fail('WARNING', 'Response does not visibly align with the active curriculum module or lesson.', { repairable: false });
  }
}
