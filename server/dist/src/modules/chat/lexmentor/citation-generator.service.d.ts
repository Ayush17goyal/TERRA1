import { ExtractedCitation, RetrievedAuthority } from './pipeline.types';
export declare class CitationGenerator {
    extract(authorities: RetrievedAuthority[], generatedAnswer?: string): ExtractedCitation[];
    private resolveAnchors;
    private extractFromText;
    private upsert;
    private citationKey;
}
