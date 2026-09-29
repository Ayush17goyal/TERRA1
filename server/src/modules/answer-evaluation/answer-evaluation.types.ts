import { ModelAnswerComponent, ModelAnswerKeyword } from '../model-answer/model-answer.types';
import { RubricComponent } from '../question-bank/question-bank.types';

export const ANSWER_EVALUATION_DIMENSIONS = [
  'rule_statement',
  'application',
  'authority_usage',
  'issue_spotting',
  'conclusion',
] as const;

export type AnswerEvaluationDimension = (typeof ANSWER_EVALUATION_DIMENSIONS)[number];
export type AnswerEvaluationStatus = 'evaluated' | 'needs_review';

export interface AnswerEvaluationRequest {
  questionId?: string;
  studentAnswer: string;
  question?: string;
  rubric?: RubricComponent[];
  modelAnswer?: {
    components: ModelAnswerComponent[];
    examinerKeywords?: ModelAnswerKeyword[];
  };
  maxMarks?: number;
  timeSpentSeconds?: number;
}

export interface DimensionEvaluation {
  dimension: AnswerEvaluationDimension;
  label: string;
  maxMarks: number;
  marksAwarded: number;
  score: number;
  matchedSignals: string[];
  missingSignals: string[];
}

export interface AnswerEvaluationResult {
  attemptId: string;
  questionId?: string;
  modelAnswerId?: string;
  marksAwarded: number;
  maxMarks: number;
  percentage: number;
  status: AnswerEvaluationStatus;
  criteriaScores: DimensionEvaluation[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  feedback?: string;
}


