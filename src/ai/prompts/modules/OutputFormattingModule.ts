import type { PromptModule } from '../interfaces';
import type { PromptAssemblyRequest, PromptModuleFragment } from '../types';

export class OutputFormattingModule implements PromptModule {
  readonly name = 'output_formatting' as const;

  shouldInclude(): boolean {
    return true;
  }

  build(request: PromptAssemblyRequest): PromptModuleFragment {
    const output = request.output;
    const reviewMode = ['review', 'revision', 'capstone'].includes(request.intent);

    return {
      moduleName: this.name,
      priority: 'medium',
      tokenBudget: { target: 420, max: 620 },
      includedReason: 'Every response needs concise counsel-style structure and a next-action constraint.',
      instructions: [
        output?.responseFormat ? `Use response format: ${output.responseFormat}.` : 'Use the response structure implied by the selected teaching strategy.',
        output?.requiredSections?.length ? `Required sections: ${output.requiredSections.join('; ')}.` : '',
        output?.maxLength ? `Target response length: ${output.maxLength}.` : 'Keep the answer concise enough for the student to act immediately.',
        reviewMode
          ? 'For draft review, use natural counsel-style headings only if helpful: What works, The legal-effect problem, Why it matters, Your revision move.'
          : 'For teaching, avoid robotic headings. Use a short counsel-style progression: drafting choice, reason, specimen insight if available, narrow example, student move.',
        'Do not use headings named "Learning Objective", "Professor\'s Note", "Drafting Tip", or "Watch This Mistake" unless the requested output schema explicitly requires them.',
        'Include only one fictional example unless the student explicitly asks for comparison.',
        'Ask for exactly one student action at the end. Do not add a second exercise, homework list, or broad checklist.',
        'Do not include generic placeholders. Make examples specific to the student\'s topic while avoiding a complete assignment answer.',
        'When giving an Arrangement of Sections, provide headings only, not fully drafted provisions.',
        output?.includeReflectionQuestions ? 'If reflection is required, ask only one reflection question.' : '',
        output?.includeStrengthsWeaknesses ? 'Include strengths and weaknesses only when reviewing submitted work.' : '',
        output?.includeNextAction === false ? '' : 'End with a concrete next action for the student and then stop.',
      ].filter(Boolean).join('\n'),
      contextVariables: { output, reviewMode },
    };
  }
}
