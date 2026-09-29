import { KnowledgeEngineService } from './knowledge-engine.service';
export declare class KnowledgeEngineQueueService {
    private readonly knowledgeEngine;
    private readonly logger;
    private readonly maxConcurrent;
    private active;
    private readonly pending;
    private readonly queued;
    constructor(knowledgeEngine: KnowledgeEngineService);
    enqueue(documentId: string): void;
    private drain;
}
