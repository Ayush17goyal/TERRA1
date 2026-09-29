export const QUESTION_MARK_VALUES = [5, 10, 15, 20] as const;
export type QuestionMarkValue = (typeof QUESTION_MARK_VALUES)[number];

export const QUESTION_TYPES = [
  'short',
  'long',
  'analytical',
  'comparative',
  'critical',
  'case_based',
  'problem_based',
] as const;
export type PlannedQuestionType = (typeof QUESTION_TYPES)[number];

export interface QuestionRequirement {
  tkuId: string;
  topic: string;
  subtopic: string;
  questionType: PlannedQuestionType;
  markValue: QuestionMarkValue;
  eligible: boolean;
  requiredEntityTypes: string[];
  availableEntityCounts: Record<string, number>;
  missingRequirements: string[];
  recommendedSlotCount: number;
  eligibilityScore: number;
}

export interface CoverageMatrixCell extends QuestionRequirement {}

export interface CoverageMatrixRow {
  tkuId: string;
  topic: string;
  subtopic: string;
  coverageScore: number;
  confidenceScore: number;
  eligibleCells: number;
  blockedCells: number;
  cells: CoverageMatrixCell[];
}

export interface MarkDistributionEntry {
  topic: string;
  subtopic: string;
  markValue: QuestionMarkValue;
  plannedSlots: number;
  plannedMarks: number;
}

export interface TypeDistributionEntry {
  questionType: PlannedQuestionType;
  plannedSlots: number;
  plannedMarks: number;
}

export interface QuestionPlanSummary {
  totalSlots: number;
  totalMarks: number;
  topicCount: number;
  generatedFromTkuVersions: Record<string, number>;
}
