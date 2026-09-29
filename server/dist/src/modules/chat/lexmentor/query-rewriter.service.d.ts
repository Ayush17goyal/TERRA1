import { OpenRouterAiProviderService } from '../openrouter-ai-provider.service';
import { BgeM3Provider } from '../../retrieval/bge-m3.provider';
import { ExpandedQueries, LegalIntent } from './pipeline.types';
export declare class QueryRewriter {
    private readonly aiProvider;
    private readonly embedProvider;
    private readonly logger;
    constructor(aiProvider: OpenRouterAiProviderService, embedProvider: BgeM3Provider);
    rewrite(query: string, intent: LegalIntent, history: Array<{
        role: string;
        content: string;
    }>): Promise<ExpandedQueries>;
    private generateHydeVector;
    private decomposeQuery;
    private buildRetrievalQuery;
    private msg;
}
