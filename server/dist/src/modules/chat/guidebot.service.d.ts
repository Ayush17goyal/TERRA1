import { OpenRouterAiProviderService } from './openrouter-ai-provider.service';
export interface GuideBotMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
}
export declare class GuideBotService {
    private readonly aiProvider;
    private readonly logger;
    private sessionsCache;
    constructor(aiProvider: OpenRouterAiProviderService);
    private getOpenAiClient;
    transcribeAudio(fileBuffer: Buffer, filename: string): Promise<string>;
    textToSpeech(text: string): Promise<Buffer>;
    sendMessage(userId: string, sessionId: string, message: string): Promise<{
        sessionId: string;
        content: string;
    }>;
    getHistory(userId: string, sessionId: string): Promise<GuideBotMessage[] | {
        role: string;
        content: string;
        timestamp: Date;
    }[]>;
    clearSession(userId: string, sessionId: string): Promise<{
        success: boolean;
    }>;
    private normalizeInput;
}
