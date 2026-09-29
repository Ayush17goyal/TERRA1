import { ChatService } from './chat.service';
import { GuideBotService } from './guidebot.service';
import { Response } from 'express';
export declare class ChatController {
    private readonly chatService;
    private readonly guideBotService;
    constructor(chatService: ChatService, guideBotService: GuideBotService);
    sendMessage(body: {
        sessionId: string;
        message: string;
        depth: string;
        references?: Array<{
            id: string;
            content: string;
        }>;
    }, req: any): Promise<{
        sessionId: string;
        messageId: string;
        content: string;
        citations: any[];
        provider: string;
        model: string;
        supportingCitations?: undefined;
        retrievedAuthorities?: undefined;
        verification?: undefined;
        verificationPanelAvailable?: undefined;
        intent?: undefined;
    } | {
        sessionId: string;
        messageId: string;
        content: string;
        citations: any[];
        supportingCitations: import("./lexmentor/pipeline.types").ExtractedCitation[];
        retrievedAuthorities: import("./lexmentor/pipeline.types").RetrievedAuthority[];
        verification: import("./lexmentor/pipeline.types").AuthorityVerification;
        verificationPanelAvailable: boolean;
        intent: import("./lexmentor/pipeline.types").LegalIntent;
        provider: string;
        model: string;
    }>;
    sendGuideBotMessage(body: {
        sessionId: string;
        message: string;
    }, req: any): Promise<{
        sessionId: string;
        content: string;
    }>;
    speechToText(file: any): Promise<{
        text: string;
    }>;
    textToSpeech(body: {
        text: string;
    }, res: Response): Promise<void>;
    getGuideBotHistory(sessionId: string, req: any): Promise<import("./guidebot.service").GuideBotMessage[] | {
        role: string;
        content: string;
        timestamp: Date;
    }[]>;
    clearGuideBotSession(sessionId: string, req: any): Promise<{
        success: boolean;
    }>;
    getHistory(sessionId: string, req: any): Promise<any[]>;
    clearSession(sessionId: string, req: any): Promise<{
        success: boolean;
    }>;
    getFallbackMetrics(): Promise<{
        failuresByModel: Record<string, number>;
        totalRequests: number;
        level1Hits: number;
        level2Hits: number;
        level3Hits: number;
        level4Hits: number;
        level5Hits: number;
        level6Hits: number;
    }>;
    getTokenAnalytics(): Promise<{
        lexmentor: {
            totalRequests: number;
            totalPromptTokens: number;
            totalCompletionTokens: number;
            averageCompletionTokens: number;
        };
        research: {
            totalRequests: number;
            totalPromptTokens: number;
            totalCompletionTokens: number;
            averageCompletionTokens: number;
        };
        judgment: {
            totalRequests: number;
            totalPromptTokens: number;
            totalCompletionTokens: number;
            averageCompletionTokens: number;
        };
        notebook: {
            totalRequests: number;
            totalPromptTokens: number;
            totalCompletionTokens: number;
            averageCompletionTokens: number;
        };
    }>;
    getCacheAnalytics(): Promise<any>;
    vectorSearch(body: {
        query: string;
    }): Promise<any[]>;
    getCitations(messageId: string, req: any): Promise<any[]>;
}
