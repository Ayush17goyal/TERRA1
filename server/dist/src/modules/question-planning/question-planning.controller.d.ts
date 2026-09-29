import { QuestionPlanningService } from './question-planning.service';
export declare class QuestionPlanningController {
    private readonly planning;
    constructor(planning: QuestionPlanningService);
    build(req: any): Promise<import("./entities/question-plan.entity").QuestionPlanEntity>;
    plan(req: any): Promise<import("./entities/question-plan.entity").QuestionPlanEntity>;
    slots(req: any): Promise<import("./entities/question-slot.entity").QuestionSlotEntity[]>;
    coverageMatrix(req: any): Promise<import("./question-planning.types").CoverageMatrixRow[]>;
}
