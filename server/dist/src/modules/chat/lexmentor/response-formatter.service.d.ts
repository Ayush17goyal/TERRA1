import { AuthorityVerification, ExtractedCitation, LegalIntent, RetrievedAuthority } from './pipeline.types';
export declare class ResponseFormatter {
    format(content: string, intent: LegalIntent, authorities: RetrievedAuthority[], citations: ExtractedCitation[], verification: AuthorityVerification, retrievalConfidence?: number, fromUploadedDocument?: boolean): string;
    templateFor(intent: LegalIntent): string;
    private resolveAnchors;
    private stripUnverifiedCitations;
    private buildSourcesBlock;
}
