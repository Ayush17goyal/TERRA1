import { CoverageMatrixRow, MarkDistributionEntry, QuestionPlanSummary, QuestionRequirement, TypeDistributionEntry } from '../question-planning.types';
export declare class QuestionPlanEntity {
    id: string;
    userId: string;
    status: 'ready' | 'empty' | 'stale';
    coverageMatrix: CoverageMatrixRow[];
    markDistribution: MarkDistributionEntry[];
    typeDistribution: TypeDistributionEntry[];
    questionRequirements: QuestionRequirement[];
    summary: QuestionPlanSummary;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
