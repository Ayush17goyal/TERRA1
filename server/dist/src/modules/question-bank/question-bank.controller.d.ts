import { QuestionBankService } from './question-bank.service';
export declare class QuestionBankController {
    private readonly questionBank;
    constructor(questionBank: QuestionBankService);
    create(req: any): Promise<import("./question-bank.types").QuestionBankGenerationSummary>;
    list(req: any): Promise<import("./entities/question-bank-entry.entity").QuestionBankEntryEntity[]>;
    get(id: string, req: any): Promise<import("./entities/question-bank-entry.entity").QuestionBankEntryEntity>;
}
