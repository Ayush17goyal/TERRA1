import { AnswerEvaluationRequest } from './answer-evaluation.types';
import { AnswerEvaluationService } from './answer-evaluation.service';
export declare class AnswerEvaluationController {
    private readonly answerEvaluation;
    constructor(answerEvaluation: AnswerEvaluationService);
    evaluate(body: AnswerEvaluationRequest, req: any): Promise<import("./answer-evaluation.types").AnswerEvaluationResult>;
    history(req: any): Promise<import("./entities/answer-evaluation-attempt.entity").AnswerEvaluationAttemptEntity[]>;
    questionHistory(questionId: string, req: any): Promise<import("./entities/answer-evaluation-attempt.entity").AnswerEvaluationAttemptEntity[]>;
    getAttempt(id: string, req: any): Promise<import("./entities/answer-evaluation-attempt.entity").AnswerEvaluationAttemptEntity>;
}
