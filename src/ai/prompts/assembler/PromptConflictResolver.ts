import type { PromptConflictResolverContract } from '../interfaces';
import type { PromptAssemblyRequest, PromptModuleFragment } from '../types';

export class PromptConflictResolver implements PromptConflictResolverContract {
  resolve(
    fragments: PromptModuleFragment[],
    request: PromptAssemblyRequest
  ): { fragments: PromptModuleFragment[]; warnings: string[] } {
    const warnings: string[] = [];
    const riskFlags = request.safety?.riskFlags ?? [];
    const restricted =
      request.safety?.assessmentMode ||
      request.safety?.allowedAssistanceLevel === 'hint_only' ||
      riskFlags.includes('academic_integrity') ||
      riskFlags.includes('complete_bare_act_request');

    if (!restricted) {
      return { fragments, warnings };
    }

    const resolved = fragments.map((fragment) => {
      if (!['teaching_strategy', 'draft_review', 'output_formatting', 'capstone'].includes(fragment.moduleName)) {
        return fragment;
      }

      warnings.push(`${fragment.moduleName} constrained by safety or assessment boundary.`);
      return {
        ...fragment,
        instructions: [
          fragment.instructions,
          'Conflict resolution: do not provide final answers, full rewrites, or complete Bare Act text. Prefer critique, hints, checklists, questions, and staged revision.',
        ].join('\n'),
      };
    });

    return { fragments: resolved, warnings };
  }
}
