import { LegalDomainClassifierService } from '../legal-domain/legal-domain-classifier.service';
import { LexMentorAiService } from './lexmentor-ai.service';
import { SettingsService } from '../settings/settings.service';
import { FallbackMetricsService } from './fallback-metrics.service';
import { TokenOptimizationService } from './token-optimization.service';
import { SemanticCacheService } from './semantic-cache.service';
export declare class ChatService {
    private readonly lexMentorAi;
    private readonly legalClassifier;
    private readonly settings;
    private readonly metricsService;
    private readonly tokenService;
    private readonly cacheService;
    private sessionsCache;
    private messageCitationsCache;
    constructor(lexMentorAi: LexMentorAiService, legalClassifier: LegalDomainClassifierService, settings: SettingsService, metricsService: FallbackMetricsService, tokenService: TokenOptimizationService, cacheService: SemanticCacheService);
    getFallbackMetrics(): {
        failuresByModel: Record<string, number>;
        totalRequests: number;
        level1Hits: number;
        level2Hits: number;
        level3Hits: number;
        level4Hits: number;
        level5Hits: number;
        level6Hits: number;
    };
    getTokenAnalytics(): {
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
    };
    getCacheAnalytics(): Promise<any>;
    sendMessage(userId: string, sessionId: string, message: string, depth: string, references?: Array<{
        id: string;
        content: string;
    }>): Promise<{
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
    getHistory(userId: string, sessionId: string): Promise<any[]>;
    clearSession(userId: string, sessionId: string): Promise<{
        success: boolean;
    }>;
    search(query: string): Promise<any[]>;
    getCitations(userId: string, messageId: string): Promise<any[]>;
    private scopedSessionId;
    private scopedMessageId;
    private isGreetingOnly;
    private normalizeInput;
    private logQuestion;
}
