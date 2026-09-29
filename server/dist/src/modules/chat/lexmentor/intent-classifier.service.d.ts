import { OpenRouterAiProviderService } from '../openrouter-ai-provider.service';
import { LegalIntent } from './pipeline.types';
export declare class IntentClassifier {
    private readonly aiProvider;
    private readonly logger;
    constructor(aiProvider: OpenRouterAiProviderService);
    classify(query: string): Promise<{
        intent: LegalIntent;
        confidence: number;
    }>;
    private parseResponse;
    private msg;
}
