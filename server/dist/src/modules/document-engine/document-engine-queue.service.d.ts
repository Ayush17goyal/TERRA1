import { DocumentEnginePipelineService } from './document-engine-pipeline.service';
export declare class DocumentEngineQueueService {
    private readonly pipeline;
    private readonly logger;
    private readonly maxConcurrent;
    private active;
    private readonly pending;
    constructor(pipeline: DocumentEnginePipelineService);
    enqueue(documentId: string): void;
    private drain;
}
