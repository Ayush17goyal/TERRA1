import { LegalIntent, RetrievedAuthority } from './pipeline.types';
export declare class Reranker {
    private readonly logger;
    rerank(intent: LegalIntent, authorities: RetrievedAuthority[]): RetrievedAuthority[];
    private intentAlignmentScore;
    private recencyScore;
    private extractYear;
    private clamp;
}
