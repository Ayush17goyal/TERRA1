import { QdrantService } from './qdrant.service';
import { BgeM3Provider } from './bge-m3.provider';
export type RetrievalCollection = 'judgments' | 'acts' | 'research_papers' | 'law_commission_reports' | 'user_documents';
export declare class VectorSearchService {
    private readonly qdrantService;
    private readonly bgeM3Provider;
    private readonly logger;
    constructor(qdrantService: QdrantService, bgeM3Provider: BgeM3Provider);
    upsertDocument(collection: RetrievalCollection, id: string, text: string, metadata?: Record<string, any>): Promise<void>;
    search(collection: RetrievalCollection, query: string, limit?: number, filter?: any): Promise<any[]>;
    private generateQdrantVector;
    private generateLocalEmbedding;
    deleteDocument(collection: RetrievalCollection, id: string): Promise<void>;
    clearCollection(collection: RetrievalCollection): Promise<void>;
}
