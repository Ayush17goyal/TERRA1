import { QuestionPlanningService } from './question-planning.service';
import { QuestionBankQueueService } from '../question-bank/question-bank-queue.service';
export declare class QuestionPlanningQueueService {
    private readonly questionPlanning;
    private readonly questionBankQueue?;
    private readonly logger;
    private readonly maxConcurrent;
    private active;
    private readonly pending;
    private readonly queued;
    constructor(questionPlanning: QuestionPlanningService, questionBankQueue?: QuestionBankQueueService);
    enqueue(userId: string): void;
    private drain;
}
