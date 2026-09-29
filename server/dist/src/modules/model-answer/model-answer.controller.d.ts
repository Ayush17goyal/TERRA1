import { ModelAnswerService } from './model-answer.service';
export declare class ModelAnswerController {
    private readonly modelAnswers;
    constructor(modelAnswers: ModelAnswerService);
    create(req: any): Promise<import("./model-answer.types").ModelAnswerGenerationSummary>;
    list(req: any): Promise<import("./entities/model-answer-entry.entity").ModelAnswerEntryEntity[]>;
    get(id: string, req: any): Promise<import("./entities/model-answer-entry.entity").ModelAnswerEntryEntity>;
}
