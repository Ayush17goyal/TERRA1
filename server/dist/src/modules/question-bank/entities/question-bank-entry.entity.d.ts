import { PlannedQuestionType, QuestionMarkValue } from '../../question-planning/question-planning.types';
import { BoundEntityReference, QuestionDifficulty, QuestionValidationStatus, RubricComponent } from '../question-bank.types';
import { SourceReference } from '../../knowledge-engine/knowledge-engine.types';
export declare class QuestionBankEntryEntity {
    id: string;
    userId: string;
    planId: string;
    slotId: string;
    tkuId: string;
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
    modelAnswer: string | null;
    validationStatus: QuestionValidationStatus;
    validationReasons: string[];
    sourceTkuVersion: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
