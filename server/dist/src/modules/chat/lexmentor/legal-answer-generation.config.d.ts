import { AnswerDepth, LegalIntent } from './pipeline.types';
export type LegalAnswerTaskType = 'simple_legal_query' | 'detailed_explanation' | 'legal_research';
export declare const LEGAL_ANSWER_LLM_CONFIG: {
    readonly temperature: 0.1;
    readonly topP: 0.2;
    readonly frequencyPenalty: 0;
    readonly presencePenalty: 0;
};
export declare const LEGAL_ANSWER_MAX_TOKENS: Record<LegalAnswerTaskType, number>;
export declare const LEGAL_ANSWER_VALIDATION_CONFIG: {
    readonly minSimilarityScore: 0.8;
    readonly minConfidenceForDefinitiveAnswer: 0.8;
    readonly mediumConfidenceFloor: 0.55;
};
export declare const LEGAL_VERIFICATION_FAILURE_MESSAGE = "I could not verify this information from the available legal sources.";
export declare function classifyLegalAnswerTask(intent: LegalIntent, depth: AnswerDepth): LegalAnswerTaskType;
