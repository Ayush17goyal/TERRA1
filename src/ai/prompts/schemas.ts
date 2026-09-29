import type { PromptAssemblyRequest, PromptIntent, TeachingStrategy } from './types';

const intents: PromptIntent[] = [
  'learning',
  'drafting',
  'review',
  'revision',
  'quiz',
  'assessment',
  'capstone',
  'bare_act_analysis',
  'out_of_scope',
  'mixed',
  'low_confidence',
];

const strategies: TeachingStrategy[] = [
  'teach',
  'question',
  'hint',
  'review',
  'demonstrate',
  'quiz',
  'assessment_feedback',
  'revision_guidance',
  'capstone_review',
  'safe_redirect',
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePromptAssemblyRequest(request: PromptAssemblyRequest): ValidationResult {
  const errors: string[] = [];

  if (!request.userMessage?.trim()) {
    errors.push('userMessage is required.');
  }

  if (!intents.includes(request.intent)) {
    errors.push(`Unsupported intent: ${request.intent}`);
  }

  if (!strategies.includes(request.teachingStrategy)) {
    errors.push(`Unsupported teaching strategy: ${request.teachingStrategy}`);
  }

  if ((request.intent === 'review' || request.intent === 'revision') && !request.draft?.text?.trim()) {
    errors.push('Draft text is required for review or revision intent.');
  }

  if (request.intent === 'bare_act_analysis' && !request.bareAct?.excerpt?.trim() && !request.bareAct?.title?.trim()) {
    errors.push('Bare Act title or excerpt is required for Bare Act analysis intent.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
