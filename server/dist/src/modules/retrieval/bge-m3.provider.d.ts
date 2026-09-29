import { OnModuleInit } from '@nestjs/common';
export declare class BgeM3Provider implements OnModuleInit {
    private readonly logger;
    private client?;
    private serviceUrl;
    private isHealthy;
    private isConfigured;
    private openaiClient?;
    private usingOpenAiFallback;
    private readonly VECTOR_SIZE;
    private readonly MAX_RETRIES;
    private readonly RETRY_DELAY_MS;
    private readonly EMBED_TIMEOUT_MS;
    onModuleInit(): void;
    getVectorSize(): number;
    isAvailable(): boolean;
    checkHealth(): Promise<{
        status: string;
        model: string;
    }>;
    generateEmbedding(text: string): Promise<number[]>;
    private openaiEmbedSingle;
    private openaiEmbedBatch;
    generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
    private executeWithRetry;
}
