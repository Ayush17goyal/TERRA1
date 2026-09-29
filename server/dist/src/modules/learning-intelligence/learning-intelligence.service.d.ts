import { Repository } from 'typeorm';
import { AnalyticsEngineService } from '../analytics-engine/analytics-engine.service';
import { AnswerEvaluationAttemptEntity } from '../answer-evaluation/entities/answer-evaluation-attempt.entity';
import { MockTestPaperEntity } from '../mock-test-engine/entities/mock-test-paper.entity';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import { LearningIntelligenceReport, MockTestRecommendation, PracticeQuestionRecommendation, RevisionPlanDay } from './learning-intelligence.types';
export declare class LearningIntelligenceService {
    private readonly analytics;
    private readonly attempts;
    private readonly questions;
    private readonly mockTests;
    constructor(analytics: AnalyticsEngineService, attempts: Repository<AnswerEvaluationAttemptEntity>, questions: Repository<QuestionBankEntryEntity>, mockTests: Repository<MockTestPaperEntity>);
    getReport(userId: string): Promise<LearningIntelligenceReport>;
    getRevisionPlan(userId: string): Promise<RevisionPlanDay[]>;
    getPracticeQuestions(userId: string): Promise<PracticeQuestionRecommendation[]>;
    getMockTestRecommendations(userId: string): Promise<MockTestRecommendation[]>;
    private buildTopicRecommendations;
    private buildPracticeRecommendations;
    private buildMockTestRecommendations;
    private predictScore;
    private buildRevisionPlan;
    private buildPersonalizedRecommendations;
    private priorityFor;
    private topicReason;
    private uniqueQuestionTopics;
    private priorityRank;
    private round;
}
