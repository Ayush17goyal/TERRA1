export declare const QUESTION_MARK_VALUES: readonly [5, 10, 15, 20];
export type QuestionMarkValue = (typeof QUESTION_MARK_VALUES)[number];
export declare const QUESTION_TYPES: readonly ["short", "long", "analytical", "comparative", "critical", "case_based", "problem_based"];
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
export interface CoverageMatrixCell extends QuestionRequirement {
}
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
