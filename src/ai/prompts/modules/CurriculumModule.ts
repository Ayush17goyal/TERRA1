import type { PromptModule } from '../interfaces';
import type { PromptAssemblyRequest, PromptModuleFragment } from '../types';

export class CurriculumModule implements PromptModule {
  readonly name = 'curriculum' as const;

  shouldInclude(request: PromptAssemblyRequest): boolean {
    return Boolean(
      request.curriculum &&
      ['learning', 'drafting', 'quiz', 'assessment', 'mixed', 'low_confidence'].includes(request.intent)
    );
  }

  build(request: PromptAssemblyRequest): PromptModuleFragment {
    const curriculum = request.curriculum;

    return {
      moduleName: this.name,
      priority: 'high',
      tokenBudget: { target: 420, max: 650 },
      includedReason: 'Aligns response to course progression and mastery criteria.',
      instructions: [
        curriculum?.moduleTitle ? `Current module: ${curriculum.moduleTitle}.` : '',
        curriculum?.learningOutcomes?.length ? `Learning outcomes: ${curriculum.learningOutcomes.join('; ')}.` : '',
        curriculum?.prerequisites?.length ? `Prerequisites: ${curriculum.prerequisites.join('; ')}.` : '',
        curriculum?.masteryCriteria?.length ? `Mastery criteria: ${curriculum.masteryCriteria.join('; ')}.` : '',
        curriculum?.blockingGaps?.length ? `Blocking prerequisite gaps: ${curriculum.blockingGaps.join('; ')}.` : '',
        'Respect progression: purpose before actors, actors before duties, duties before powers/procedure, procedure before offences/penalties, penalties before review/savings.',
        'Do not jump ahead unless the student demonstrates prerequisite mastery or a safety boundary requires redirecting.',
        'When curriculum state is available, the response should feel like continuity in a university drafting course, not a fresh general explanation.',
      ].filter(Boolean).join('\n'),
      contextVariables: { curriculum },
      omissionRules: ['Omit for quick standalone replies where no curriculum state is available.'],
    };
  }
}