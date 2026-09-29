import { ModelAnswerComponent, ModelAnswerKeyword } from '../../model-answer/model-answer.types';
import { RubricComponent } from '../../question-bank/question-bank.types';
import { AnswerEvaluationDimension, AnswerEvaluationStatus, DimensionEvaluation } from '../answer-evaluation.types';
export declare class AnswerEvaluationAttemptEntity {
    id: string;
    userId: string;
    questionId: string | null;
    modelAnswerId: string | null;
    studentAnswer: string;
    question: string;
    rubric: RubricComponent[];
    modelAnswerComponents: ModelAnswerComponent[];
    examinerKeywords: ModelAnswerKeyword[];
    criteriaScores: DimensionEvaluation[];
    dimensionMarks: Record<AnswerEvaluationDimension, number>;
    marksAwarded: number;
    maxMarks: number;
    percentage: number;
    timeSpentSeconds: number | null;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    status: AnswerEvaluationStatus;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
