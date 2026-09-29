import { OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
export declare class QdrantService implements OnModuleInit {
    private readonly logger;
    private client;
    static readonly COLLECTION = "legal_corpus";
    static readonly VECTOR_SIZE = 1024;
    onModuleInit(): void;
    getClient(): QdrantClient;
    initializeLegalCorpusCollection(): Promise<void>;
}
