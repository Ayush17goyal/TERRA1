import { PlannedQuestionType, QuestionMarkValue } from '../question-planning/question-planning.types';
import { SourceReference } from '../knowledge-engine/knowledge-engine.types';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionValidationStatus = 'valid' | 'needs_review' | 'rejected';
export interface BoundEntityReference {
    entityId: string;
    entityType: string;
    label: string;
    tkuId: string;
}
export interface RubricComponent {
    label: string;
    marks: number;
    criteria: string;
    boundEntityRefs: string[];
}
export interface QuestionBankGenerationSummary {
    planId: string;
    generated: number;
    valid: number;
    needsReview: number;
    rejected: number;
    attempts: number;
}
export interface ValidationCheckResult {
    gate: 'structural' | 'grounding' | 'duplicate' | 'difficulty' | 'grammar' | 'coverage' | 'quality';
    passed: boolean;
    reason?: string;
}
export interface ReusableQuestionDraft {
    question: string;
    questionType: PlannedQuestionType;
    difficulty: QuestionDifficulty;
    topic: string;
    subtopic: string;
    markValue: QuestionMarkValue;
    rubric: RubricComponent[];
    boundEntityRefs: BoundEntityReference[];
    groundingSources: SourceReference[];
    qualityScore: number;
    validationStatus: QuestionValidationStatus;
    validationReasons: string[];
}
