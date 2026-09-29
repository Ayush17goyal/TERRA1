import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEngineModule } from '../analytics-engine/analytics-engine.module';
import { AnswerEvaluationAttemptEntity } from '../answer-evaluation/entities/answer-evaluation-attempt.entity';
import { MockTestPaperEntity } from '../mock-test-engine/entities/mock-test-paper.entity';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import { QuestionMarkValue } from '../question-planning/question-planning.types';
import { LearningIntelligenceService } from './learning-intelligence.service';

describe('LearningIntelligenceService (integration)', () => {
  let service: LearningIntelligenceService;
  let attempts: Repository<AnswerEvaluationAttemptEntity>;
  let questions: Repository<QuestionBankEntryEntity>;
  let mockTests: Repository<MockTestPaperEntity>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [AnswerEvaluationAttemptEntity, QuestionBankEntryEntity, MockTestPaperEntity],
          synchronize: true,
        }),
        AnalyticsEngineModule,
        TypeOrmModule.forFeature([AnswerEvaluationAttemptEntity, QuestionBankEntryEntity, MockTestPaperEntity]),
      ],
      providers: [LearningIntelligenceService],
    }).compile();

    service = module.get(LearningIntelligenceService);
    attempts = module.get(getRepositoryToken(AnswerEvaluationAttemptEntity));
    questions = module.get(getRepositoryToken(QuestionBankEntryEntity));
    mockTests = module.get(getRepositoryToken(MockTestPaperEntity));
  });

  async function seedQuestion(userId: string, index: number, topic: string, subtopic: string, markValue: QuestionMarkValue = 10) {
    return questions.save(
      questions.create({
        userId,
        planId: `plan-${userId}`,
        slotId: `slot-${userId}-${index}`,
        tkuId: `tku-${index}`,
        question: `Discuss ${topic} ${subtopic} issue ${index}.`,
        questionType: index % 2 === 0 ? 'case_based' : 'analytical',
        difficulty: markValue >= 15 ? 'hard' : 'medium',
        topic,
        subtopic,
        markValue,
        rubric: [],
        boundEntityRefs: [],
        groundingSources: [],
        qualityScore: 0.8 + index * 0.01,
        validationStatus: 'valid',
        validationReasons: [],
        sourceTkuVersion: 1,
      }),
    );
  }

  async function seedAttempt(userId: string, questionId: string, percentage: number, daysAgo: number) {
    const maxMarks = 10;
    const marksAwarded = (percentage / 100) * maxMarks;
    const createdAt = new Date(Date.now() - daysAgo * 86400000);
    const attempt = attempts.create({
      userId,
      questionId,
      modelAnswerId: null,
      studentAnswer: 'Issue rule authority application conclusion answer text for analytics.',
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
      dimensionMarks: { rule_statement: 1, application: 1, authority_usage: 1, issue_spotting: 1, conclusion: 1 },
      marksAwarded,
      maxMarks,
      percentage,
      timeSpentSeconds: 600,
      strengths: [],
      weaknesses: [],
      suggestions: [],
      status: 'evaluated',
    });
    attempt.createdAt = createdAt;
    attempt.updatedAt = createdAt;
    return attempts.save(attempt);
  }

  it('generates personalized revision, practice, mock-test and predicted-score recommendations', async () => {
    const weak = await seedQuestion('user-1', 1, 'Contract Law', 'Offer');
    await seedQuestion('user-1', 2, 'Contract Law', 'Offer', 15);
    const strong = await seedQuestion('user-1', 3, 'Tort Law', 'Negligence');
    await seedQuestion('user-1', 4, 'Evidence Law', 'Admissions');
    await seedAttempt('user-1', weak.id, 45, 3);
    await seedAttempt('user-1', weak.id, 55, 2);
    await seedAttempt('user-1', strong.id, 90, 1);
    await mockTests.save(mockTests.create({
      userId: 'user-1',
      mode: 'revision',
      prompt: 'old revision',
      specification: {} as any,
      coverageSnapshot: {} as any,
      assemblySections: [],
      questionIds: [],
      totalMarks: 30,
      durationMinutes: 60,
      status: 'ready',
      shortfalls: [],
      pdfBase64: 'JVBERi0=',
      generationTimeMs: 100,
    }));

    const report = await service.getReport('user-1');

    expect(report.topicsToRevise[0].topic).toBe('Contract Law');
    expect(report.questionsToPractice.length).toBeGreaterThan(0);
    expect(report.newMockTests.length).toBeGreaterThan(0);
    expect(report.predictedScore.percentage).toBeGreaterThan(0);
    expect(report.revisionPlan.length).toBeGreaterThanOrEqual(7);
    expect(report.personalizedRecommendations.some((item) => item.category === 'practice')).toBe(true);
  });

  it('keeps recommendations isolated by user', async () => {
    const weak = await seedQuestion('user-1', 1, 'Contract Law', 'Offer');
    await seedAttempt('user-1', weak.id, 45, 1);

    const report = await service.getReport('user-2');

    expect(report.topicsToRevise).toHaveLength(0);
    expect(report.questionsToPractice).toHaveLength(0);
    expect(report.predictedScore.percentage).toBe(0);
  });
});

