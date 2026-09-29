import { LearningIntelligenceService } from './learning-intelligence.service';
export declare class LearningIntelligenceController {
    private readonly learningIntelligence;
    constructor(learningIntelligence: LearningIntelligenceService);
    recommendations(req: any): Promise<import("./learning-intelligence.types").LearningIntelligenceReport>;
    revisionPlan(req: any): Promise<import("./learning-intelligence.types").RevisionPlanDay[]>;
    practiceQuestions(req: any): Promise<import("./learning-intelligence.types").PracticeQuestionRecommendation[]>;
    mockTests(req: any): Promise<import("./learning-intelligence.types").MockTestRecommendation[]>;
}
