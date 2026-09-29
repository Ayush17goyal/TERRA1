"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETRIEVAL_CONFIDENCE_THRESHOLD = exports.LEXMENTOR_UPLOADED_DOC_NOTE = exports.LEXMENTOR_LEGAL_DISCLAIMER = exports.LEXMENTOR_NO_AUTHORITATIVE_MATERIAL = exports.LEXMENTOR_CANNOT_VERIFY_RESPONSE = exports.LEXMENTOR_LOW_CONFIDENCE_RESPONSE = exports.LEXMENTOR_LEGAL_ONLY_REJECTION = void 0;
exports.computeRetrievalConfidence = computeRetrievalConfidence;
exports.hasUploadedDocumentSources = hasUploadedDocumentSources;
exports.buildMissingMaterialGuidance = buildMissingMaterialGuidance;
exports.buildInsufficientConfidenceResponse = buildInsufficientConfidenceResponse;
exports.buildNoRetrievalResponse = buildNoRetrievalResponse;
exports.buildLegalEvidenceFailureResponse = buildLegalEvidenceFailureResponse;
exports.formatConfidenceLevel = formatConfidenceLevel;
const legal_answer_generation_config_1 = require("./legal-answer-generation.config");
exports.LEXMENTOR_LEGAL_ONLY_REJECTION = 'LexMentor AI is designed exclusively for legal education and legal research. Please ask a question related to law.';
exports.LEXMENTOR_LOW_CONFIDENCE_RESPONSE = 'I am not sufficiently confident to provide a reliable legal answer based on the available legal sources.';
exports.LEXMENTOR_CANNOT_VERIFY_RESPONSE = legal_answer_generation_config_1.LEGAL_VERIFICATION_FAILURE_MESSAGE + ' Please upload the relevant document or refine your question.';
exports.LEXMENTOR_NO_AUTHORITATIVE_MATERIAL = 'I could not locate authoritative legal material supporting this question.';
exports.LEXMENTOR_LEGAL_DISCLAIMER = 'This response is for legal education and research purposes only and should not be treated as professional legal advice.';
exports.LEXMENTOR_UPLOADED_DOC_NOTE = 'Answer generated from your uploaded document.';
exports.RETRIEVAL_CONFIDENCE_THRESHOLD = legal_answer_generation_config_1.LEGAL_ANSWER_VALIDATION_CONFIG.minConfidenceForDefinitiveAnswer;
function computeRetrievalConfidence(authorities) {
    if (!authorities.length)
        return 0;
    const topScore = authorities[0]?.rerankerScore ?? 0;
    const avgRerank = authorities.reduce((sum, a) => sum + a.rerankerScore, 0) / authorities.length;
    const avgAuthority = authorities.reduce((sum, a) => sum + a.authorityStrength, 0) / authorities.length;
    const countFactor = Math.min(1, authorities.length / 4);
    const hasUserDoc = authorities.some((a) => a.collection === 'User Uploaded Documents');
    const userDocBoost = hasUserDoc ? 0.05 : 0;
    return clamp(topScore * 0.38 +
        avgRerank * 0.28 +
        avgAuthority * 0.2 +
        countFactor * 0.09 +
        userDocBoost +
        0.05);
}
function hasUploadedDocumentSources(authorities) {
    return authorities.some((a) => a.collection === 'User Uploaded Documents');
}
function buildMissingMaterialGuidance() {
    return [
        'You may:',
        '• Upload a relevant legal document',
        '• Specify the Act name',
        '• Specify the Section or Article number',
        '• Specify the Case Name',
    ].join('\n');
}
function buildInsufficientConfidenceResponse(includeGuidance = true) {
    const sections = [
        '## Answer',
        exports.LEXMENTOR_LOW_CONFIDENCE_RESPONSE,
        '',
        '## Important Notes',
        exports.LEXMENTOR_CANNOT_VERIFY_RESPONSE,
    ];
    if (includeGuidance) {
        sections.push('', buildMissingMaterialGuidance());
    }
    sections.push('', '## Confidence Level', 'Low — retrieval confidence below the reliability threshold (80%).', '', '---', exports.LEXMENTOR_LEGAL_DISCLAIMER);
    return sections.join('\n');
}
function buildNoRetrievalResponse(includeGuidance = true) {
    const sections = [
        '## Answer',
        exports.LEXMENTOR_NO_AUTHORITATIVE_MATERIAL,
        '',
        '## Important Notes',
        exports.LEXMENTOR_CANNOT_VERIFY_RESPONSE,
    ];
    if (includeGuidance) {
        sections.push('', buildMissingMaterialGuidance());
    }
    sections.push('', '## Confidence Level', 'Low — no authoritative legal material was retrieved.', '', '---', exports.LEXMENTOR_LEGAL_DISCLAIMER);
    return sections.join('\n');
}
function buildLegalEvidenceFailureResponse(validation, includeGuidance = true) {
    const sections = [
        '## Answer',
        validation.userMessage || legal_answer_generation_config_1.LEGAL_VERIFICATION_FAILURE_MESSAGE,
        '',
        '## Legal Evidence Validation',
        `Confidence: ${validation.confidence} (${Math.round(validation.confidenceScore * 100)}%).`,
        `Reason: ${validation.reason}`,
        `Relevant legal evidence retrieved: ${validation.hasRelevantLegalEvidence ? 'Yes' : 'No'}.`,
        `Section/Article verified: ${validation.sectionOrArticleExists ? 'Yes' : 'No'}.`,
        `Retrieved text matches question: ${validation.retrievedTextMatchesQuestion ? 'Yes' : 'No'}.`,
        `Authoritative source: ${validation.sourceAuthoritative ? 'Yes' : 'No'}.`,
        `Conflicting sources: ${validation.hasConflictingSources ? 'Yes' : 'No'}.`,
    ];
    if (includeGuidance) {
        sections.push('', buildMissingMaterialGuidance());
    }
    sections.push('', '---', exports.LEXMENTOR_LEGAL_DISCLAIMER);
    return sections.join('\n');
}
function formatConfidenceLevel(score) {
    const pct = Math.round(score * 100);
    if (score >= exports.RETRIEVAL_CONFIDENCE_THRESHOLD) {
        return `High — ${pct}% retrieval confidence (meets the 80% reliability threshold).`;
    }
    if (score >= 0.55) {
        return `Medium — ${pct}% retrieval confidence (below the 80% reliability threshold).`;
    }
    return `Low — ${pct}% retrieval confidence.`;
}
function clamp(value) {
    return Math.max(0, Math.min(1, value));
}
//# sourceMappingURL=lexmentor-policy.js.map