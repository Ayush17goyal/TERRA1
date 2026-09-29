import { BgeM3Provider } from '../../retrieval/bge-m3.provider';
import { QdrantService } from '../../retrieval/qdrant.service';
import { LegalRetrievalService } from '../../retrieval/legal-retrieval.service';
import { ExpandedQueries, LegalIntent, RetrievedAuthority } from './pipeline.types';
export declare class LegalRetriever {
    private readonly qdrantService;
    private readonly embedProvider;
    private readonly legalRetrievalService;
    private readonly logger;
    constructor(qdrantService: QdrantService, embedProvider: BgeM3Provider, legalRetrievalService: LegalRetrievalService);
    retrieve(expanded: ExpandedQueries, intent: LegalIntent, userId?: string): Promise<RetrievedAuthority[]>;
    private provisionToAuthority;
    private searchAllCollections;
    private reciprocalRankFusion;
    private extractText;
    private extractTitle;
    private firstStr;
    private msg;
}
