import { PlannedQuestionType, QuestionMarkValue } from '../question-planning/question-planning.types';
import { QuestionDifficulty } from '../question-bank/question-bank.types';
export declare const MOCK_TEST_MODES: readonly ["semester", "university", "judiciary", "teacher", "revision", "custom"];
export type MockTestMode = (typeof MOCK_TEST_MODES)[number];
export type MockTestStatus = 'ready' | 'partial' | 'failed';
export interface MockTestGenerationRequest {
    prompt: string;
    mode?: MockTestMode;
}
export interface MockTestSpecification {
    mode: MockTestMode;
    totalMarks: number;
    durationMinutes: number;
    markMix: Record<QuestionMarkValue, number>;
    typeMix: Partial<Record<PlannedQuestionType, number>>;
    difficultyTargets: Record<QuestionDifficulty, number>;
    topicHints: string[];
}
export interface MockTestCoverageSnapshot {
    planId: string | null;
    totalSlots: number;
    totalMarks: number;
    topicCount: number;
    rows: Array<{
        topic: string;
        subtopic: string;
        coverageScore: number;
        confidenceScore: number;
    }>;
}
export interface MockTestAssemblySection {
    label: string;
    markValue: QuestionMarkValue;
    questionIds: string[];
    totalMarks: number;
}
export interface MockTestQuestionSelection {
    questionId: string;
    questionNumber: number;
    sectionLabel: string;
    question: string;
    questionType: PlannedQuestionType;
    difficulty: QuestionDifficulty;
    topic: string;
    subtopic: string;
    markValue: QuestionMarkValue;
    qualityScore: number;
}
export interface MockTestGenerationResult {
    paperId: string;
    status: MockTestStatus;
    mode: MockTestMode;
    totalMarks: number;
    durationMinutes: number;
    generationTimeMs: number;
    pdfBytes: number;
    selectedQuestions: MockTestQuestionSelection[];
    shortfalls: string[];
    questionsGenerated: number;
}
