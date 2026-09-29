"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const analytics_engine_module_1 = require("../analytics-engine/analytics-engine.module");
const answer_evaluation_attempt_entity_1 = require("../answer-evaluation/entities/answer-evaluation-attempt.entity");
const mock_test_paper_entity_1 = require("../mock-test-engine/entities/mock-test-paper.entity");
const question_bank_entry_entity_1 = require("../question-bank/entities/question-bank-entry.entity");
const learning_intelligence_service_1 = require("./learning-intelligence.service");
describe('LearningIntelligenceService (integration)', () => {
    let service;
    let attempts;
    let questions;
    let mockTests;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            imports: [
                typeorm_1.TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [answer_evaluation_attempt_entity_1.AnswerEvaluationAttemptEntity, question_bank_entry_entity_1.QuestionBankEntryEntity, mock_test_paper_entity_1.MockTestPaperEntity],
                    synchronize: true,
                }),
                analytics_engine_module_1.AnalyticsEngineModule,
                typeorm_1.TypeOrmModule.forFeature([answer_evaluation_attempt_entity_1.AnswerEvaluationAttemptEntity, question_bank_entry_entity_1.QuestionBankEntryEntity, mock_test_paper_entity_1.MockTestPaperEntity]),
            ],
            providers: [learning_intelligence_service_1.LearningIntelligenceService],
        }).compile();
        service = module.get(learning_intelligence_service_1.LearningIntelligenceService);
        attempts = module.get((0, typeorm_1.getRepositoryToken)(answer_evaluation_attempt_entity_1.AnswerEvaluationAttemptEntity));
        questions = module.get((0, typeorm_1.getRepositoryToken)(question_bank_entry_entity_1.QuestionBankEntryEntity));
        mockTests = module.get((0, typeorm_1.getRepositoryToken)(mock_test_paper_entity_1.MockTestPaperEntity));
    });
    async function seedQuestion(userId, index, topic, subtopic, markValue = 10) {
        return questions.save(questions.create({
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
        }));
    }
    async function seedAttempt(userId, questionId, percentage, daysAgo) {
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
            specification: {},
            coverageSnapshot: {},
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
//# sourceMappingURL=learning-intelligence.service.spec.js.map