import { AuthorityVerification, ExtractedCitation, RetrievedAuthority } from './pipeline.types';
export declare class AuthorityVerificationEngine {
    verify(authorities: RetrievedAuthority[], citations: ExtractedCitation[], answer?: string): AuthorityVerification;
    private computeBindingAuthority;
    private latestSource;
    private authorityLabel;
    private extractCitationStrings;
    private findSignals;
    private avg;
    private clamp;
}
