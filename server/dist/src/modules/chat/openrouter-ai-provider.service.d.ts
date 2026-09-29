import { FallbackMetricsService } from './fallback-metrics.service';
import { TokenOptimizationService } from './token-optimization.service';
import { ByokService } from '../settings/byok.service';
import { CreditService } from '../settings/credit.service';
import { ProviderManagementService } from '../settings/provider-management.service';
type ProviderMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string;
};
export type AiProviderCompletionInput = {
    messages: ProviderMessage[];
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    maxTokens?: number;
    timeoutMs?: number;
    preferredModel?: string;
    module?: 'lexmentor' | 'research' | 'judgment' | 'notebook' | 'studyforge' | 'exam' | 'memorial' | 'bench';
    jsonMode?: boolean;
    onToken?: (token: string) => void;
    userId?: string;
};
export type AiProviderTimingAudit = {
    provider: string;
    model: string;
    configuredTimeoutMs: number;
    actualDurationMs: number;
    timedOut: boolean;
    succeeded: boolean;
    retryAttempt: number;
};
export type AiProviderCompletionResult = {
    content: string;
    provider: string;
    model: string;
    responseTimeMs: number;
    timingAudit: AiProviderTimingAudit;
};
export declare class OpenRouterAiProviderService {
    private readonly metricsService;
    private readonly tokenService;
    private readonly byokService?;
    private readonly creditService?;
    private readonly providerManagement?;
    private readonly logger;
    constructor(metricsService: FallbackMetricsService, tokenService: TokenOptimizationService, byokService?: ByokService, creditService?: CreditService, providerManagement?: ProviderManagementService);
    private readonly providers;
    private resolveTimeout;
    private logTimingAudit;
    getProviderMetricsTable(): string;
    complete(input: AiProviderCompletionInput): Promise<AiProviderCompletionResult>;
    private tryConfiguredDirectProvider;
    private callWithDirectKey;
    private createCompletion;
    private normalizeTokenModule;
    private getSafeErrorMessage;
}
export {};
