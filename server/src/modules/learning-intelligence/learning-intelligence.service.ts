import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEngineService } from '../analytics-engine/analytics-engine.service';
import { TopicPerformanceRow } from '../analytics-engine/analytics-engine.types';
import { AnswerEvaluationAttemptEntity } from '../answer-evaluation/entities/answer-evaluation-attempt.entity';
import { MockTestPaperEntity } from '../mock-test-engine/entities/mock-test-paper.entity';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import {
  LearningIntelligenceReport,
  MockTestRecommendation,
  PersonalizedStudyRecommendation,
  PracticeQuestionRecommendation,
  RecommendationPriority,
  RevisionPlanDay,
  TopicRevisionRecommendation,
} from './learning-intelligence.types';

@Injectable()
export class LearningIntelligenceService {
  constructor(
    private readonly analytics: AnalyticsEngineService,
    @InjectRepository(AnswerEvaluationAttemptEntity)
    private readonly attempts: Repository<AnswerEvaluationAttemptEntity>,
    @InjectRepository(QuestionBankEntryEntity)
    private readonly questions: Repository<QuestionBankEntryEntity>,
    @InjectRepository(MockTestPaperEntity)
    private readonly mockTests: Repository<MockTestPaperEntity>,
  ) {}

  async getReport(userId: string): Promise<LearningIntelligenceReport> {
    const [dashboard, attempts, questions, mockTests] = await Promise.all([
      this.analytics.getDashboard(userId),
      this.attempts.find({ where: { userId }, order: { createdAt: 'ASC' } }),
      this.questions.find({ where: { userId, validationStatus: 'valid' }, order: { qualityScore: 'DESC', markValue: 'DESC' } }),
      this.mockTests.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 10 }),
    ]);
    const topicsToRevise = this.buildTopicRecommendations(dashboard.topicWisePerformance, questions);
    const questionsToPractice = this.buildPracticeRecommendations(topicsToRevise, questions, attempts);
    const newMockTests = this.buildMockTestRecommendations(topicsToRevise, dashboard.summary.averagePercentage, mockTests);
    const predictedScore = this.predictScore(dashboard.progressTracking.readinessScore, dashboard.summary.averagePercentage, dashboard.progressTracking.improvementSinceFirstAttempt, attempts.length);
    const revisionPlan = this.buildRevisionPlan(topicsToRevise, questionsToPractice, predictedScore.percentage);
    return {
      generatedAt: new Date().toISOString(),
      predictedScore,
      topicsToRevise,
      questionsToPractice,
      newMockTests,
      revisionPlan,
      personalizedRecommendations: this.buildPersonalizedRecommendations(topicsToRevise, questionsToPractice, newMockTests, predictedScore.percentage),
    };
  }

  async getRevisionPlan(userId: string): Promise<RevisionPlanDay[]> {
    return (await this.getReport(userId)).revisionPlan;
  }

  async getPracticeQuestions(userId: string): Promise<PracticeQuestionRecommendation[]> {
    return (await this.getReport(userId)).questionsToPractice;
  }

  async getMockTestRecommendations(userId: string): Promise<MockTestRecommendation[]> {
    return (await this.getReport(userId)).newMockTests;
  }

  private buildTopicRecommendations(topicRows: TopicPerformanceRow[], questions: QuestionBankEntryEntity[]): TopicRevisionRecommendation[] {
    const attempted = topicRows.map((row) => ({
      topic: row.topic,
      subtopic: row.subtopic,
      priority: this.priorityFor(row.averagePercentage, row.trend, row.attempts),
      reason: this.topicReason(row),
      targetScore: row.averagePercentage < 60 ? 70 : row.averagePercentage < 75 ? 80 : 85,
      currentScore: row.averagePercentage,
      suggestedMinutes: row.averagePercentage < 60 ? 90 : row.averagePercentage < 75 ? 60 : 35,
    }));
    const attemptedKeys = new Set(attempted.map((row) => `${row.topic}\u0000${row.subtopic}`));
    const unattempted = this.uniqueQuestionTopics(questions)
      .filter((row) => !attemptedKeys.has(`${row.topic}\u0000${row.subtopic}`))
      .slice(0, 5)
      .map((row) => ({
        topic: row.topic,
        subtopic: row.subtopic,
        priority: 'medium' as RecommendationPriority,
        reason: 'No evaluated attempts yet for this topic.',
        targetScore: 70,
        currentScore: 0,
        suggestedMinutes: 45,
      }));
    return [...attempted, ...unattempted]
      .sort((a, b) => this.priorityRank(a.priority) - this.priorityRank(b.priority) || a.currentScore - b.currentScore)
      .slice(0, 8);
  }

  private buildPracticeRecommendations(
    topicsToRevise: TopicRevisionRecommendation[],
    questions: QuestionBankEntryEntity[],
    attempts: AnswerEvaluationAttemptEntity[],
  ): PracticeQuestionRecommendation[] {
    const attemptedIds = new Set(attempts.map((attempt) => attempt.questionId).filter(Boolean));
    const topicKeys = topicsToRevise.map((topic) => `${topic.topic}\u0000${topic.subtopic}`);
    const selected: PracticeQuestionRecommendation[] = [];
    for (const key of topicKeys) {
      const [topic, subtopic] = key.split('\u0000');
      const candidates = questions
        .filter((question) => question.topic === topic && question.subtopic === subtopic)
        .sort((a, b) => Number(attemptedIds.has(a.id)) - Number(attemptedIds.has(b.id)) || b.markValue - a.markValue || b.qualityScore - a.qualityScore);
      for (const question of candidates.slice(0, 2)) {
        if (selected.some((item) => item.questionId === question.id)) continue;
        selected.push({
          questionId: question.id,
          question: question.question,
          topic: question.topic,
          subtopic: question.subtopic,
          questionType: question.questionType,
          markValue: question.markValue,
          difficulty: question.difficulty,
          reason: attemptedIds.has(question.id) ? 'Reattempt this question to check improvement.' : 'Unattempted question aligned to a revision priority.',
          priority: attemptedIds.has(question.id) ? 'medium' : 'high',
        });
      }
    }
    return selected.slice(0, 12);
  }

  private buildMockTestRecommendations(
    topicsToRevise: TopicRevisionRecommendation[],
    averagePercentage: number,
    mockTests: MockTestPaperEntity[],
  ): MockTestRecommendation[] {
    const weakTopics = topicsToRevise.filter((topic) => topic.priority === 'high').slice(0, 3);
    const targetTopics = (weakTopics.length ? weakTopics : topicsToRevise.slice(0, 3)).map((topic) => topic.topic);
    const recentModes = new Set(mockTests.slice(0, 3).map((test) => test.mode));
    const recommendations: MockTestRecommendation[] = [];
    recommendations.push({
      mode: 'revision',
      prompt: `Generate a 30 marks revision test focused on ${targetTopics.join(', ') || 'my weakest topics'}.`,
      targetTopics,
      totalMarks: 30,
      reason: 'Short revision tests help confirm whether weak topics are improving.',
      priority: 'high',
    });
    recommendations.push({
      mode: averagePercentage >= 70 ? 'university' : 'teacher',
      prompt: `Generate a ${averagePercentage >= 70 ? '100' : '50'} marks ${averagePercentage >= 70 ? 'university' : 'teacher'} style paper covering ${targetTopics.join(', ') || 'recent practice areas'}.`,
      targetTopics,
      totalMarks: averagePercentage >= 70 ? 100 : 50,
      reason: averagePercentage >= 70 ? 'You are ready for a fuller exam-format paper.' : 'A teacher-style paper is better before attempting full exam pressure.',
      priority: averagePercentage >= 70 ? 'medium' : 'high',
    });
    if (!recentModes.has('judiciary')) {
      recommendations.push({
        mode: 'judiciary',
        prompt: `Generate a judiciary mains practice paper with problem-based questions on ${targetTopics.join(', ') || 'core topics'}.`,
        targetTopics,
        totalMarks: 100,
        reason: 'Problem-based practice improves application and authority usage.',
        priority: 'medium',
      });
    }
    return recommendations.slice(0, 3);
  }

  private predictScore(readinessScore: number, averagePercentage: number, improvement: number, attempts: number) {
    const practiceConfidence = Math.min(1, attempts / 8);
    const projected = this.round(Math.max(0, Math.min(100, averagePercentage * 0.55 + readinessScore * 0.35 + Math.max(-8, Math.min(12, improvement)) * 0.1 + practiceConfidence * 6)));
    return {
      percentage: projected,
      band: projected >= 75 ? 'exam_ready' as const : projected >= 60 ? 'improving' as const : 'needs_work' as const,
      confidence: this.round(0.35 + practiceConfidence * 0.55, 2),
      rationale: attempts < 3 ? 'Prediction is early because only a few evaluated attempts are available.' : 'Prediction blends average marks, readiness, trend, and practice depth.',
    };
  }

  private buildRevisionPlan(
    topicsToRevise: TopicRevisionRecommendation[],
    questionsToPractice: PracticeQuestionRecommendation[],
    predictedScore: number,
  ): RevisionPlanDay[] {
    const days = predictedScore < 60 ? 10 : 7;
    const plan: RevisionPlanDay[] = [];
    for (let day = 1; day <= days; day++) {
      const topic = topicsToRevise[(day - 1) % Math.max(1, topicsToRevise.length)];
      const questions = questionsToPractice.filter((question) => !topic || (question.topic === topic.topic && question.subtopic === topic.subtopic)).slice(0, 2);
      plan.push({
        day,
        focus: topic ? `${topic.topic} - ${topic.subtopic}` : 'Mixed revision',
        topics: topic ? [topic.topic, topic.subtopic] : [],
        practiceQuestionIds: questions.map((question) => question.questionId),
        estimatedMinutes: topic?.suggestedMinutes || 45,
        tasks: [
          topic ? `Revise core rules and authorities for ${topic.topic} / ${topic.subtopic}.` : 'Revise one weak topic and one strong topic.',
          questions.length ? 'Attempt the recommended practice questions under timed conditions.' : 'Attempt any valid question from the question bank for this topic.',
          day % 3 === 0 ? 'Generate a short revision mock test and evaluate at least one answer.' : 'Update notes with missed rules, cases, and conclusion patterns.',
        ],
      });
    }
    return plan;
  }

  private buildPersonalizedRecommendations(
    topicsToRevise: TopicRevisionRecommendation[],
    questionsToPractice: PracticeQuestionRecommendation[],
    mockTests: MockTestRecommendation[],
    predictedScore: number,
  ): PersonalizedStudyRecommendation[] {
    const recommendations: PersonalizedStudyRecommendation[] = [];
    const topWeak = topicsToRevise[0];
    if (topWeak) {
      recommendations.push({
        title: `Revise ${topWeak.topic}`,
        category: 'revision',
        priority: topWeak.priority,
        rationale: topWeak.reason,
        action: `Spend ${topWeak.suggestedMinutes} minutes on ${topWeak.subtopic}, then reattempt a related answer.`,
      });
    }
    if (questionsToPractice.length > 0) {
      recommendations.push({
        title: 'Practice targeted answer writing',
        category: 'practice',
        priority: 'high',
        rationale: `${questionsToPractice.length} suitable questions are available from your validated question bank.`,
        action: 'Attempt the first 3 recommended questions and run answer evaluation after each.',
      });
    }
    if (mockTests.length > 0) {
      recommendations.push({
        title: 'Generate the next mock test',
        category: 'mock_test',
        priority: mockTests[0].priority,
        rationale: mockTests[0].reason,
        action: mockTests[0].prompt,
      });
    }
    recommendations.push({
      title: predictedScore >= 75 ? 'Shift to full papers' : 'Build score before full papers',
      category: 'exam_strategy',
      priority: predictedScore >= 75 ? 'medium' : 'high',
      rationale: `Predicted score is ${predictedScore}%.`,
      action: predictedScore >= 75 ? 'Attempt one full paper every 2-3 days and evaluate all weak answers.' : 'Use short revision tests until weak topics cross 70%.',
    });
    return recommendations;
  }

  private priorityFor(score: number, trend: number, attempts: number): RecommendationPriority {
    if (score < 60 || trend < -8 || attempts < 2) return 'high';
    if (score < 75 || trend < 0) return 'medium';
    return 'low';
  }

  private topicReason(row: TopicPerformanceRow): string {
    if (row.attempts < 2) return 'Needs more evaluated attempts before performance is reliable.';
    if (row.averagePercentage < 60) return 'Average score is below 60%.';
    if (row.trend < 0) return 'Recent performance is declining.';
    if (row.averagePercentage < 75) return 'Score is improving but not yet exam-ready.';
    return 'Maintain this topic with light revision.';
  }

  private uniqueQuestionTopics(questions: QuestionBankEntryEntity[]) {
    const seen = new Set<string>();
    return questions.filter((question) => {
      const key = `${question.topic}\u0000${question.subtopic}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private priorityRank(priority: RecommendationPriority): number {
    return priority === 'high' ? 0 : priority === 'medium' ? 1 : 2;
  }

  private round(value: number, places = 2): number {
    const factor = 10 ** places;
    return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
  }
}
