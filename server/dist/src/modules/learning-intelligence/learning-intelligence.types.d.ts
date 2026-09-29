import { PlannedQuestionType, QuestionMarkValue } from '../question-planning/question-planning.types';
export type RecommendationPriority = 'high' | 'medium' | 'low';
export interface TopicRevisionRecommendation {
    topic: string;
    subtopic: string;
    priority: RecommendationPriority;
    reason: string;
    targetScore: number;
    currentScore: number;
    suggestedMinutes: number;
}
export interface PracticeQuestionRecommendation {
    questionId: string;
    question: string;
    topic: string;
    subtopic: string;
    questionType: PlannedQuestionType;
    markValue: QuestionMarkValue;
    difficulty: string;
    reason: string;
    priority: RecommendationPriority;
}
export interface MockTestRecommendation {
    mode: 'semester' | 'university' | 'judiciary' | 'teacher' | 'revision' | 'custom';
    prompt: string;
    targetTopics: string[];
    totalMarks: number;
    reason: string;
    priority: RecommendationPriority;
}
export interface RevisionPlanDay {
    day: number;
    focus: string;
    topics: string[];
    practiceQuestionIds: string[];
    estimatedMinutes: number;
    tasks: string[];
}
export interface PersonalizedStudyRecommendation {
    title: string;
    category: 'revision' | 'practice' | 'mock_test' | 'exam_strategy';
    priority: RecommendationPriority;
    rationale: string;
    action: string;
}
export interface LearningIntelligenceReport {
    generatedAt: string;
    predictedScore: {
        percentage: number;
        band: 'needs_work' | 'improving' | 'exam_ready';
        confidence: number;
        rationale: string;
    };
    topicsToRevise: TopicRevisionRecommendation[];
    questionsToPractice: PracticeQuestionRecommendation[];
    newMockTests: MockTestRecommendation[];
    revisionPlan: RevisionPlanDay[];
    personalizedRecommendations: PersonalizedStudyRecommendation[];
}
