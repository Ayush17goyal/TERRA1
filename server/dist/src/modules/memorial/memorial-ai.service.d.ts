import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
import { MemorialWorkflowOptions } from './memorial.types';
export declare class MemorialAiService {
    private readonly aiProvider;
    private readonly logger;
    constructor(aiProvider: OpenRouterAiProviderService);
    json<T>(params: {
        system: string;
        prompt: string;
        options: MemorialWorkflowOptions;
        maxTokens?: number;
        temperature?: number;
        stage: string;
    }): Promise<T>;
    private parseJson;
}
