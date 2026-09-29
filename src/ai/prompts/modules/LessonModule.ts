import type { PromptModule } from '../interfaces';
import type { PromptAssemblyRequest, PromptModuleFragment } from '../types';

export class LessonModule implements PromptModule {
  readonly name = 'lesson' as const;

  shouldInclude(request: PromptAssemblyRequest): boolean {
    return Boolean(request.curriculum?.lessonId || request.curriculum?.lessonTitle);
  }

  build(request: PromptAssemblyRequest): PromptModuleFragment {
    const curriculum = request.curriculum;

    return {
      moduleName: this.name,
      priority: 'high',
      tokenBudget: { target: 340, max: 500 },
      includedReason: 'Narrows the response to the active lesson objective and prevents jumping ahead.',
      instructions: [
        curriculum?.lessonTitle ? `Current lesson: ${curriculum.lessonTitle}.` : '',
        curriculum?.masteryCriteria?.length ? `Lesson mastery evidence required: ${curriculum.masteryCriteria.join('; ')}.` : '',
        'Continue from the active lesson state. Do not restart the curriculum and do not introduce later drafting components unless needed to correct a prerequisite gap.',
        'Convert the lesson into one immediate micro-skill. The response should teach only that micro-skill and ask for one attempt that demonstrates mastery evidence.',
        'If the student asks a broad topic question while in a lesson, answer through the current lesson lens instead of giving a whole Act structure.',
      ].filter(Boolean).join('\n'),
      contextVariables: {
        lessonId: curriculum?.lessonId,
        lessonTitle: curriculum?.lessonTitle,
        masteryCriteria: curriculum?.masteryCriteria,
      },
    };
  }
}