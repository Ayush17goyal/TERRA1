import { OpenRouterAiProviderService } from '../openrouter-ai-provider.service';
import { BuiltLegalContext, LegalIntent, LegalReasoningResult, AnswerDepth } from './pipeline.types';
import { LegalEvidenceValidationResult } from './legal-evidence-validator.service';
type ChatMessage = {
    role: 'user' | 'assistant' | 'system';
    content: string;
};
export declare class LegalReasoningEngine {
    private readonly aiProvider;
    private readonly logger;
    constructor(aiProvider: OpenRouterAiProviderService);
    generate(input: {
        query: string;
        depth: AnswerDepth;
        intent: LegalIntent;
        context: BuiltLegalContext;
        history: ChatMessage[];
        userId?: string;
        onToken?: (token: string) => void;
        fromUploadedDocument?: boolean;
        evidenceValidation?: LegalEvidenceValidationResult;
        references?: Array<{
            id: string;
            content: string;
        }>;
        retrievalConfidence?: number;
    }): Promise<LegalReasoningResult>;
    private buildUserPrompt;
    buildSystemPromptFor(intent: LegalIntent, depth: AnswerDepth, hasSources: boolean): string;
    templateFor(intent: LegalIntent): string;
}
export {};
