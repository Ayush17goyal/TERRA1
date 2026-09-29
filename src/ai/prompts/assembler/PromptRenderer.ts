import type { PromptRendererContract } from '../interfaces';
import type { PromptAssemblyRequest, PromptModuleFragment, PromptPriority } from '../types';

const priorityRank: Record<PromptPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const moduleOrder = [
  'core',
  'safety',
  'behaviour',
  'teaching_strategy',
  'curriculum',
  'lesson',
  'student_context',
  'pattern',
  'bare_act_analysis',
  'capstone',
  'draft_review',
  'output_formatting',
];

export class PromptRenderer implements PromptRendererContract {
  render(fragments: PromptModuleFragment[], request: PromptAssemblyRequest): string {
    const sorted = [...fragments].sort((a, b) => {
      const orderDiff = moduleOrder.indexOf(a.moduleName) - moduleOrder.indexOf(b.moduleName);
      if (orderDiff !== 0) {
        return orderDiff;
      }

      return priorityRank[a.priority] - priorityRank[b.priority];
    });

    const moduleText = sorted
      .map((fragment) => [`## ${fragment.moduleName}`, fragment.instructions].join('\n'))
      .join('\n\n');

    return [
      moduleText,
      '## current_user_message',
      request.normalizedMessage ?? request.userMessage,
    ].join('\n\n');
  }
}
