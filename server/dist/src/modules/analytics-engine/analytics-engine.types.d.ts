import { AnswerEvaluationDimension } from '../answer-evaluation/answer-evaluation.types';
export interface TopicPerformanceRow {
    topic: string;
    subtopic: string;
    attempts: number;
    averageMarks: number;
    averageMaxMarks: number;
    averagePercentage: number;
    bestPercentage: number;
    latestPercentage: number;
    trend: number;
    lastAttemptAt: string | null;
}
export interface DimensionPerformanceRow {
    dimension: AnswerEvaluationDimension;
    label: string;
    attempts: number;
    averagePercentage: number;
    averageMarks: number;
    maxMarks: number;
}
export interface ImprovementPoint {
    attemptId: string;
    sequence: number;
    date: string;
    percentage: number;
    rollingAverage: number;
    marksAwarded: number;
    maxMarks: number;
}
export interface DailyProgressPoint {
    date: string;
    attempts: number;
    averagePercentage: number;
    totalMarksAwarded: number;
    totalMaxMarks: number;
}
export interface TimeAnalysis {
    attemptsWithRecordedTime: number;
    averageTimeSeconds: number | null;
    fastestTimeSeconds: number | null;
    slowestTimeSeconds: number | null;
    estimatedAverageTimeSeconds: number;
    averageAnswerWords: number;
    averageWordsPerMinute: number | null;
    practiceCadence: DailyProgressPoint[];
}
export interface ProgressTracking {
    totalAttempts: number;
    completedTopics: number;
    currentStreakDays: number;
    bestStreakDays: number;
    latestAttemptAt: string | null;
    improvementSinceFirstAttempt: number;
    readinessScore: number;
}
export interface AnalyticsDashboard {
    generatedAt: string;
    summary: {
        attempts: number;
        averageMarks: number;
        averageMaxMarks: number;
        averagePercentage: number;
        totalMarksAwarded: number;
        totalMaxMarks: number;
    };
    topicWisePerformance: TopicPerformanceRow[];
    weakTopics: TopicPerformanceRow[];
    strongTopics: TopicPerformanceRow[];
    dimensionPerformance: DimensionPerformanceRow[];
    timeAnalysis: TimeAnalysis;
    improvementGraph: ImprovementPoint[];
    progressTracking: ProgressTracking;
}
