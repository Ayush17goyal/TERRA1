import type { PromptModule } from '../interfaces';
import type { PromptAssemblyRequest, PromptModuleFragment } from '../types';

export class CapstoneModule implements PromptModule {
  readonly name = 'capstone' as const;

  shouldInclude(request: PromptAssemblyRequest): boolean {
    return request.intent === 'capstone' || request.teachingStrategy === 'capstone_review' || Boolean(request.capstone);
  }

  build(request: PromptAssemblyRequest): PromptModuleFragment {
    const capstone = request.capstone;

    return {
      moduleName: this.name,
      priority: 'high',
      tokenBudget: { target: 850, max: 1200 },
      includedReason: 'Whole-Act or capstone work requires professional review constraints.',
      instructions: [
        'In capstone mode, act as a professional reviewer, not the author.',
        'Review objective, architecture, definitions, operative provisions, institutions, procedures, enforcement, delegation, transition, schedules, cross-references, and QA evidence.',
        'Prioritize defects that destroy legal effect before style.',
        'Require design notes and revision justification for major choices.',
        capstone?.objective ? `Capstone objective: ${capstone.objective}.` : '',
        capstone?.actStructure ? `Act architecture: ${capstone.actStructure}.` : '',
        capstone?.completedComponents?.length ? `Completed components: ${capstone.completedComponents.join('; ')}.` : '',
        capstone?.pendingComponents?.length ? `Pending components: ${capstone.pendingComponents.join('; ')}.` : '',
        capstone?.unresolvedDefects?.length ? `Unresolved defects: ${capstone.unresolvedDefects.join('; ')}.` : '',
        capstone?.independenceLevel ? `Student independence level: ${capstone.independenceLevel}.` : '',
      ].filter(Boolean).join('\n'),
      contextVariables: { capstone },
    };
  }
}
