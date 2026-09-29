import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerEvaluationAttemptEntity } from '../answer-evaluation/entities/answer-evaluation-attempt.entity';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import { AnalyticsEngineService } from './analytics-engine.service';

describe('AnalyticsEngineService (integration)', () => {
  let service: AnalyticsEngineService;
  let attempts: Repository<AnswerEvaluationAttemptEntity>;
  let questions: Repository<QuestionBankEntryEntity>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [AnswerEvaluationAttemptEntity, QuestionBankEntryEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([AnswerEvaluationAttemptEntity, QuestionBankEntryEntity]),
      ],
      providers: [AnalyticsEngineService],
    }).compile();

    service = module.get(AnalyticsEngineService);
    attempts = module.get(getRepositoryToken(AnswerEvaluationAttemptEntity));
    questions = module.get(getRepositoryToken(QuestionBankEntryEntity));
  });

  async function seedQuestion(userId: string, idSuffix: string, topic: string, subtopic: string) {
    return questions.save(
      questions.create({
        userId,
        planId: `plan-${userId}`,
        slotId: `slot-${userId}-${idSuffix}`,
        tkuId: `tku-${idSuffix}`,
        question: `Discuss ${topic} ${subtopic}.`,
        questionType: 'analytical',
        difficulty: 'medium',
        topic,
        subtopic,
        markValue: 10,
        rubric: [],
        boundEntityRefs: [],
        groundingSources: [],
        qualityScore: 0.8,
        validationStatus: 'valid',
        validationReasons: [],
        sourceTkuVersion: 1,
      }),
    );
  }

  async function seedAttempt(userId: string, questionId: string, percentage: number, daysAgo: number, timeSpentSeconds?: number) {
    const maxMarks = 10;
    const marksAwarded = (percentage / 100) * maxMarks;
    const createdAt = new Date(Date.now() - daysAgo * 86400000);
    const attempt = attempts.create({
      userId,
      questionId,
      modelAnswerId: null,
      studentAnswer: 'This answer states the issue, rule, authority, application and conclusion for the question.',
      question: 'Discuss the issue.',
      rubric: [],
      modelAnswerComponents: [],
      examinerKeywords: [],
      criteriaScores: [
        { dimension: 'rule_statement', label: 'Rule Statement', maxMarks: 2.5, marksAwarded: marksAwarded * 0.25, score: percentage / 100, matchedSignals: [], missingSignals: [] },
        { dimension: 'application', label: 'Application', maxMarks: 2.5, marksAwarded: marksAwarded * 0.25, score: percentage / 100, matchedSignals: [], missingSignals: [] },
        { dimension: 'authority_usage', label: 'Authority Usage', maxMarks: 2, marksAwarded: marksAwarded * 0.2, score: percentage / 100, matchedSignals: [], missingSignals: [] },
        { dimension: 'issue_spotting', label: 'Issue Spotting', maxMarks: 1.5, marksAwarded: marksAwarded * 0.15, score: percentage / 100, matchedSignals: [], missingSignals: [] },
        { dimension: 'conclusion', label: 'Conclusion', maxMarks: 1.5, marksAwarded: marksAwarded * 0.15, score: percentage / 100, matchedSignals: [], missingSignals: [] },
      ],
      dimensionMarks: { rule_statement: 2, application: 2, authority_usage: 1, issue_spotting: 1, conclusion: 1 },
      marksAwarded,
      maxMarks,
      percentage,
      timeSpentSeconds: timeSpentSeconds || null,
      strengths: [],
      weaknesses: [],
      suggestions: [],
      status: 'evaluated',
    });
    attempt.createdAt = createdAt;
    attempt.updatedAt = createdAt;
    return attempts.save(attempt);
  }

  it('generates topic-wise performance, weak topics, strong topics and progress tracking', async () => {
    const contract = await seedQuestion('user-1', 'contract', 'Contract Law', 'Offer');
    const tort = await seedQuestion('user-1', 'tort', 'Tort Law', 'Negligence');
    await seedAttempt('user-1', contract.id, 45, 3, 600);
    await seedAttempt('user-1', contract.id, 55, 2, 540);
    await seedAttempt('user-1', tort.id, 95, 1, 480);
    await seedAttempt('user-1', tort.id, 95, 0, 460);

    const dashboard = await service.getDashboard('user-1');

    expect(dashboard.summary.attempts).toBe(4);
    expect(dashboard.summary.averagePercentage).toBeGreaterThan(70);
    expect(dashboard.topicWisePerformance).toHaveLength(2);
    expect(dashboard.weakTopics.map((row) => row.topic)).toContain('Contract Law');
    expect(dashboard.strongTopics.map((row) => row.topic)).toContain('Tort Law');
    expect(dashboard.improvementGraph).toHaveLength(4);
    expect(dashboard.progressTracking.improvementSinceFirstAttempt).toBeGreaterThan(0);
    expect(dashboard.timeAnalysis.attemptsWithRecordedTime).toBe(4);
    expect(dashboard.dimensionPerformance).toHaveLength(5);
  });

  it('keeps analytics isolated by user', async () => {
    const contract = await seedQuestion('user-1', 'contract', 'Contract Law', 'Offer');
    await seedAttempt('user-1', contract.id, 90, 0);

    const dashboard = await service.getDashboard('user-2');

    expect(dashboard.summary.attempts).toBe(0);
    expect(dashboard.topicWisePerformance).toHaveLength(0);
    expect(dashboard.progressTracking.readinessScore).toBe(0);
  });
});



