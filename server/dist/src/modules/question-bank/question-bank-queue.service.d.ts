import { QuestionBankService } from './question-bank.service';
import { ModelAnswerQueueService } from '../model-answer/model-answer-queue.service';
export declare class QuestionBankQueueService {
    private readonly questionBank;
    private readonly modelAnswerQueue?;
    private readonly logger;
    private readonly maxConcurrent;
    private active;
    private readonly pending;
    private readonly queued;
    constructor(questionBank: QuestionBankService, modelAnswerQueue?: ModelAnswerQueueService);
    enqueue(userId: string): void;
    private drain;
}
