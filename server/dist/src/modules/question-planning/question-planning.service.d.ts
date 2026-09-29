import { Repository } from 'typeorm';
import { TopicKnowledgeUnitEntity } from '../knowledge-engine/entities/topic-knowledge-unit.entity';
import { QuestionPlanEntity } from './entities/question-plan.entity';
import { QuestionSlotEntity } from './entities/question-slot.entity';
import { CoverageMatrixRow } from './question-planning.types';
export declare class QuestionPlanningService {
    private readonly tkus;
    private readonly plans;
    private readonly slots;
    constructor(tkus: Repository<TopicKnowledgeUnitEntity>, plans: Repository<QuestionPlanEntity>, slots: Repository<QuestionSlotEntity>);
    buildPlan(userId: string): Promise<QuestionPlanEntity>;
    getPlan(userId: string): Promise<QuestionPlanEntity>;
    getSlots(userId: string): Promise<QuestionSlotEntity[]>;
    getCoverageMatrix(userId: string): Promise<CoverageMatrixRow[]>;
    private buildCoverageRow;
    private evaluateRequirement;
    private countEntities;
    private requiredEntityTypes;
    private minimumFor;
    private countForType;
    private depthScore;
    private depthThreshold;
    private eligibilityScore;
    private slotCount;
    private buildMarkDistribution;
    private buildTypeDistribution;
    private buildSlots;
    private round;
}
