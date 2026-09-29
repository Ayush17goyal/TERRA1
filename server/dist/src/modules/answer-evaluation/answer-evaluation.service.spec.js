"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const model_answer_entry_entity_1 = require("../model-answer/entities/model-answer-entry.entity");
const question_bank_entry_entity_1 = require("../question-bank/entities/question-bank-entry.entity");
const answer_evaluation_service_1 = require("./answer-evaluation.service");
const answer_evaluation_attempt_entity_1 = require("./entities/answer-evaluation-attempt.entity");
describe('AnswerEvaluationService (integration)', () => {
    let service;
    let questions;
    let answers;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            imports: [
                typeorm_1.TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [question_bank_entry_entity_1.QuestionBankEntryEntity, model_answer_entry_entity_1.ModelAnswerEntryEntity, answer_evaluation_attempt_entity_1.AnswerEvaluationAttemptEntity],
                    synchronize: true,
                }),
                typeorm_1.TypeOrmModule.forFeature([question_bank_entry_entity_1.QuestionBankEntryEntity, model_answer_entry_entity_1.ModelAnswerEntryEntity, answer_evaluation_attempt_entity_1.AnswerEvaluationAttemptEntity]),
            ],
            providers: [answer_evaluation_service_1.AnswerEvaluationService],
        }).compile();
        service = module.get(answer_evaluation_service_1.AnswerEvaluationService);
        questions = module.get((0, typeorm_1.getRepositoryToken)(question_bank_entry_entity_1.QuestionBankEntryEntity));
        answers = module.get((0, typeorm_1.getRepositoryToken)(model_answer_entry_entity_1.ModelAnswerEntryEntity));
    });
    async function seedQuestionAndAnswer(userId = 'user-1') {
        const question = await questions.save(questions.create({
            userId,
            planId: 'plan-1',
            slotId: `slot-${userId}`,
            tkuId: 'tku-1',
            question: 'Discuss whether communication of offer is necessary under Contract Law.',
            questionType: 'analytical',
            difficulty: 'medium',
            topic: 'Contract Law',
            subtopic: 'Offer',
            markValue: 10,
            rubric: [
                { label: 'Issue and rule', marks: 3, criteria: 'Identify the issue and state the governing provision or principle.', boundEntityRefs: ['p1'] },
                { label: 'Application and authority', marks: 5, criteria: 'Apply the rule using authority and case law.', boundEntityRefs: ['p1', 'c1'] },
                { label: 'Conclusion', marks: 2, criteria: 'Conclude with a precise legal position.', boundEntityRefs: ['p1'] },
            ],
            boundEntityRefs: [
                { entityId: 'p1', entityType: 'principle', label: 'Offer must be communicated', tkuId: 'tku-1' },
                { entityId: 'c1', entityType: 'case', label: 'Carlill v Carbolic Smoke Ball Co', tkuId: 'tku-1' },
            ],
            groundingSources: [{ documentId: 'doc-1', sourceType: 'document' }],
            qualityScore: 0.88,
            validationStatus: 'valid',
            validationReasons: [],
            sourceTkuVersion: 1,
        }));
        const modelAnswer = await answers.save(answers.create({
            userId,
            questionId: question.id,
            tkuId: 'tku-1',
            question: question.question,
            markValue: 10,
            components: [
                { type: 'introduction', title: 'Introduction', paragraphs: [{ text: 'The issue is whether an offer becomes legally effective without communication.', boundEntityRefs: [], groundingSources: [] }] },
                { type: 'relevant_sections', title: 'Relevant Sections', paragraphs: [{ text: 'Section 2(a) defines proposal and requires signification of willingness.', boundEntityRefs: [], groundingSources: [] }] },
                { type: 'legal_principles', title: 'Legal Principles', paragraphs: [{ text: 'Offer must be communicated to create legal effect and acceptance must correspond to it.', boundEntityRefs: [], groundingSources: [] }] },
                { type: 'explanation', title: 'Explanation', paragraphs: [{ text: 'On application, the facts must show knowledge of the offer before acceptance.', boundEntityRefs: [], groundingSources: [] }] },
                { type: 'case_law', title: 'Case Law', paragraphs: [{ text: 'Carlill v Carbolic Smoke Ball Co held that a reward advertisement may amount to an offer.', boundEntityRefs: [], groundingSources: [] }] },
                { type: 'conclusion', title: 'Conclusion', paragraphs: [{ text: 'Therefore, communication is necessary unless the facts show clear public notification of the offer.', boundEntityRefs: [], groundingSources: [] }] },
            ],
            examinerKeywords: [
                { keyword: 'Section 2(a)', groundingSources: [] },
                { keyword: 'communication of offer', groundingSources: [] },
                { keyword: 'Carlill v Carbolic Smoke Ball Co', groundingSources: [] },
            ],
            boundEntityRefs: [],
            groundingSources: [{ documentId: 'doc-1', sourceType: 'document' }],
            qualityScore: 0.9,
            validationStatus: 'valid',
            validationReasons: [],
            sourceQuestionVersion: 1,
        }));
        return { question, modelAnswer };
    }
    it('evaluates a student answer and stores attempt history', async () => {
        const { question, modelAnswer } = await seedQuestionAndAnswer();
        const result = await service.evaluate('user-1', {
            questionId: question.id,
            studentAnswer: 'The issue is whether communication of offer is necessary. Section 2(a) defines proposal as signification of willingness. The rule is that offer must be communicated before acceptance. Applying this, the offeree must know the offer before acting. Carlill v Carbolic Smoke Ball Co shows authority for public reward offers. Therefore communication is necessary unless public notification is clear.',
        });
        const history = await service.listQuestionHistory('user-1', question.id);
        expect(result.questionId).toBe(question.id);
        expect(result.modelAnswerId).toBe(modelAnswer.id);
        expect(result.marksAwarded).toBeGreaterThanOrEqual(7);
        expect(result.maxMarks).toBe(10);
        expect(result.criteriaScores).toHaveLength(5);
        expect(result.strengths.length).toBeGreaterThan(0);
        expect(history).toHaveLength(1);
        expect(history[0].studentAnswer).toContain('Section 2(a)');
    });
    it('returns weaknesses and suggestions for a sparse answer', async () => {
        const { question } = await seedQuestionAndAnswer();
        const result = await service.evaluate('user-1', {
            questionId: question.id,
            studentAnswer: 'An offer is important in contract law. The answer depends on facts and the court will decide. Therefore it may be valid.',
        });
        expect(result.marksAwarded).toBeLessThan(6);
        expect(result.weaknesses.length).toBeGreaterThan(0);
        expect(result.suggestions.some((suggestion) => suggestion.toLowerCase().includes('authority') || suggestion.toLowerCase().includes('rule'))).toBe(true);
    });
    it('keeps evaluation history isolated by user', async () => {
        const { question } = await seedQuestionAndAnswer('user-1');
        await expect(service.evaluate('user-2', {
            questionId: question.id,
            studentAnswer: 'The answer states the issue, rule, application, authority and conclusion in sufficient detail.',
        })).rejects.toThrow('Validated question not found.');
        expect(await service.listHistory('user-2')).toHaveLength(0);
    });
});
//# sourceMappingURL=answer-evaluation.service.spec.js.map