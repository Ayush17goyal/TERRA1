import { ModelAnswerComponent, ModelAnswerKeyword, ModelAnswerValidationStatus } from '../model-answer.types';
import { SourceReference } from '../../knowledge-engine/knowledge-engine.types';
import { BoundEntityReference } from '../../question-bank/question-bank.types';
export declare class ModelAnswerEntryEntity {
    id: string;
    userId: string;
    questionId: string;
    tkuId: string;
    question: string;
    markValue: number;
    components: ModelAnswerComponent[];
    examinerKeywords: ModelAnswerKeyword[];
    boundEntityRefs: BoundEntityReference[];
    groundingSources: SourceReference[];
    qualityScore: number;
    validationStatus: ModelAnswerValidationStatus;
    validationReasons: string[];
    sourceQuestionVersion: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
