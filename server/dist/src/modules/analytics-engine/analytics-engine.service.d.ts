import { Repository } from 'typeorm';
import { AnswerEvaluationAttemptEntity } from '../answer-evaluation/entities/answer-evaluation-attempt.entity';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import { AnalyticsDashboard, ImprovementPoint, TimeAnalysis, TopicPerformanceRow } from './analytics-engine.types';
export declare class AnalyticsEngineService {
    private readonly attempts;
    private readonly questions;
    constructor(attempts: Repository<AnswerEvaluationAttemptEntity>, questions: Repository<QuestionBankEntryEntity>);
    getDashboard(userId: string): Promise<AnalyticsDashboard>;
    getTopicPerformance(userId: string): Promise<TopicPerformanceRow[]>;
    getProgress(userId: string): Promise<{
        progressTracking: import("./analytics-engine.types").ProgressTracking;
        improvementGraph: ImprovementPoint[];
        timeAnalysis: TimeAnalysis;
    }>;
    getWeakTopics(userId: string): Promise<TopicPerformanceRow[]>;
    getStrongTopics(userId: string): Promise<TopicPerformanceRow[]>;
    private attachTopics;
    private buildSummary;
    private buildTopicPerformance;
    private buildDimensionPerformance;
    private buildImprovementGraph;
    private buildTimeAnalysis;
    private buildDailyProgress;
    private buildProgressTracking;
    private currentStreak;
    private bestStreak;
    private inferTopic;
    private wordCount;
    private average;
    private dimensionLabel;
    private round;
}
