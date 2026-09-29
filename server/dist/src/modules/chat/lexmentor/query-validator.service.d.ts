export type QueryValidationResult = {
    isValid: boolean;
    needsClarification: boolean;
    clarificationMessage?: string;
    normalizedQuery: string;
    detectedIssues: string[];
};
export declare class QueryValidator {
    private readonly logger;
    validate(query: string): QueryValidationResult;
    private detectActTypo;
    private detectSectionAmbiguity;
    private detectLegacyActReference;
}
