import { ModelAnswerService } from './model-answer.service';
export declare class ModelAnswerQueueService {
    private readonly modelAnswer;
    private readonly logger;
    private readonly maxConcurrent;
    private active;
    private readonly pending;
    private readonly queued;
    constructor(modelAnswer: ModelAnswerService);
    enqueue(userId: string): void;
    private drain;
}
