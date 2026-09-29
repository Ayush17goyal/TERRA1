import { BoundEntityReference } from '../question-bank/question-bank.types';
import { SourceReference } from '../knowledge-engine/knowledge-engine.types';

export type ModelAnswerComponentType =
  | 'introduction'
  | 'relevant_sections'
  | 'legal_principles'
  | 'explanation'
  | 'case_law'
  | 'critical_analysis'
  | 'conclusion'
  | 'examiner_keywords';

export type ModelAnswerValidationStatus = 'valid' | 'rejected';

export interface GroundedParagraph {
  text: string;
  boundEntityRefs: BoundEntityReference[];
  groundingSources: SourceReference[];
}

export interface ModelAnswerComponent {
  type: ModelAnswerComponentType;
  title: string;
  paragraphs: GroundedParagraph[];
}

export interface ModelAnswerKeyword {
  keyword: string;
  groundingSources: SourceReference[];
}

export interface AnswerValidationCheckResult {
  gate: 'grounding' | 'hallucination' | 'case_accuracy' | 'legal_accuracy' | 'structure' | 'keywords';
  passed: boolean;
  reason?: string;
}

export interface ModelAnswerGenerationSummary {
  generated: number;
  valid: number;
  rejected: number;
  attempts: number;
}
