import type { PromptModule } from '../interfaces';
import type { PromptAssemblyRequest, PromptModuleFragment } from '../types';

export class DraftReviewModule implements PromptModule {
  readonly name = 'draft_review' as const;

  shouldInclude(request: PromptAssemblyRequest): boolean {
    return Boolean(request.draft?.text && ['review', 'revision', 'drafting', 'capstone', 'mixed'].includes(request.intent));
  }

  build(request: PromptAssemblyRequest): PromptModuleFragment {
    const draft = request.draft;

    return {
      moduleName: this.name,
      priority: 'high',
      tokenBudget: { target: 850, max: 1150 },
      includedReason: 'Submitted draft text requires sentence-level legislative drafting review.',
      instructions: [
        'Review as a Parliamentary Counsel reviewing a pupil drafter: precise, evidence-based, and concerned with legal effect.',
        'Review every sentence individually when the draft is short enough. For each material sentence, identify: legislative purpose, legal subject, legal object, operative verb, obligation or discretion, ambiguity, enforceability, proportionality, terminology, convention, cross-reference risk, and interpretation risk.',
        'Do not simply say good, correct, unclear, or needs improvement. Explain why the drafting choice succeeds or fails legally.',
        'Do not re-teach the entire topic. Use the draft as evidence and focus on the highest-impact weakness for the next revision.',
        'Required review sequence: what the sentence is trying to do; what works; the most serious legal-effect problem; why it matters; one revision instruction for the student.',
        'Do not rewrite the student\'s work unless the selected teaching strategy explicitly allows a narrow demonstration. Preserve student authorship.',
        'Prioritize unclear legal effect, missing actor, missing condition, missing consequence, undefined terms, circular definitions, overbreadth, under-inclusion, incorrect modal verb, broken cross-reference, and structural inconsistency.',
        'If discussing wording, explain the legal consequence of the wording choice. For example, explain how "shall" imposes obligation and "may" confers discretion instead of merely replacing words.',
        draft?.objective ? `Student objective: ${draft.objective}.` : 'If the objective is unclear, ask before deep review.',
        draft?.componentType ? `Draft component type: ${draft.componentType}.` : '',
        draft?.previousFeedback ? `Previous feedback to check against: ${draft.previousFeedback}.` : '',
        `Draft under review:\n${draft?.text ?? ''}`,
      ].filter(Boolean).join('\n'),
      contextVariables: { draft },
    };
  }
}
