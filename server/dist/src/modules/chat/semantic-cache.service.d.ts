import { OnModuleDestroy } from '@nestjs/common';
import { BgeM3Provider } from '../retrieval/bge-m3.provider';
import { FallbackMetricsService } from './fallback-metrics.service';
import { LegalSource } from './legal-source.types';
import { ByokService } from '../settings/byok.service';
export declare class SemanticCacheService implements OnModuleDestroy {
    private readonly bgeM3Provider;
    private readonly metricsService;
    private readonly byokService?;
    private readonly logger;
    private client;
    private isConnected;
    private fallbackMemoryCache;
    constructor(bgeM3Provider: BgeM3Provider, metricsService: FallbackMetricsService, byokService?: ByokService);
    private initRedis;
    onModuleDestroy(): Promise<void>;
    private getHash;
    private cosineSimilarity;
    private getCostFactor;
    get(moduleName: string, queryText: string, userId?: string): Promise<any | null>;
    set(moduleName: string, queryText: string, value: any, metadata?: Record<string, any>): Promise<void>;
    getLegalReferences(queryText: string): Promise<LegalSource[] | null>;
    setLegalReferences(queryText: string, sources: LegalSource[]): Promise<void>;
    private recordTelemetry;
    recordPipelineMetrics(levelName: 'qdrantHits' | 'geminiHits' | 'gptHits' | 'deepseekHits' | 'friendlyHits'): Promise<void>;
    isDocumentIngested(hash: string): Promise<boolean>;
    recordIngestedDocument(hash: string): Promise<void>;
    getAnalytics(): Promise<any>;
}
