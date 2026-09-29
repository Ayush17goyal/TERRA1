import { BuiltLegalContext, LegalIntent } from './pipeline.types';
export type LegalEvidenceConfidence = 'high' | 'medium' | 'low';
export interface LegalEvidenceValidationResult {
    confidence: LegalEvidenceConfidence;
    confidenceScore: number;
    canGenerateDefinitiveAnswer: boolean;
    hasRelevantLegalEvidence: boolean;
    sectionOrArticleExists: boolean;
    retrievedTextMatchesQuestion: boolean;
    sourceAuthoritative: boolean;
    hasConflictingSources: boolean;
    reason: string;
    userMessage?: string;
}
export declare class LegalEvidenceValidator {
    validate(input: {
        query: string;
        intent: LegalIntent;
        context: BuiltLegalContext;
        retrievalConfidence: number;
    }): LegalEvidenceValidationResult;
    private sectionOrArticleExists;
    private retrievedTextMatchesQuestion;
    private hasConflictingSources;
    private confidenceScore;
    private reason;
    private failureMessage;
    private extractRequestedReferences;
    private authorityContainsReference;
    private normalizeReferenceNumber;
    private significantTerms;
}
