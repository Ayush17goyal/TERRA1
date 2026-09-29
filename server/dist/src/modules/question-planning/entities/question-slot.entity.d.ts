import { PlannedQuestionType, QuestionMarkValue } from '../question-planning.types';
export declare class QuestionSlotEntity {
    id: string;
    planId: string;
    userId: string;
    tkuId: string;
    topic: string;
    subtopic: string;
    questionType: PlannedQuestionType;
    markValue: QuestionMarkValue;
    slotIndex: number;
    eligibilityScore: number;
    requiredEntityRefs: string[];
    requirements: Record<string, any>;
    status: 'planned';
    createdAt: Date;
    updatedAt: Date;
}
