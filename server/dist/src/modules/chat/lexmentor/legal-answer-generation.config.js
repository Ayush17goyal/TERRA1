"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGAL_VERIFICATION_FAILURE_MESSAGE = exports.LEGAL_ANSWER_VALIDATION_CONFIG = exports.LEGAL_ANSWER_MAX_TOKENS = exports.LEGAL_ANSWER_LLM_CONFIG = void 0;
exports.classifyLegalAnswerTask = classifyLegalAnswerTask;
exports.LEGAL_ANSWER_LLM_CONFIG = {
    temperature: 0.1,
    topP: 0.2,
    frequencyPenalty: 0,
    presencePenalty: 0,
};
exports.LEGAL_ANSWER_MAX_TOKENS = {
    simple_legal_query: 800,
    detailed_explanation: 1500,
    legal_research: 2500,
};
exports.LEGAL_ANSWER_VALIDATION_CONFIG = {
    minSimilarityScore: 0.8,
    minConfidenceForDefinitiveAnswer: 0.8,
    mediumConfidenceFloor: 0.55,
};
exports.LEGAL_VERIFICATION_FAILURE_MESSAGE = 'I could not verify this information from the available legal sources.';
function classifyLegalAnswerTask(intent, depth) {
    if (intent === 'Research' || intent === 'Case Law' || intent === 'Moot Court' || depth === 'Expert') {
        return 'legal_research';
    }
    if (depth === 'Intermediate' || intent === 'Constitutional Law' || intent === 'Drafting' || intent === 'Contract') {
        return 'detailed_explanation';
    }
    return 'simple_legal_query';
}
//# sourceMappingURL=legal-answer-generation.config.js.map