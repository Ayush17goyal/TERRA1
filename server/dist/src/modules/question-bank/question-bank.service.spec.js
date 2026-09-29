"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const topic_knowledge_unit_entity_1 = require("../knowledge-engine/entities/topic-knowledge-unit.entity");
const question_plan_entity_1 = require("../question-planning/entities/question-plan.entity");
const question_slot_entity_1 = require("../question-planning/entities/question-slot.entity");
const question_bank_entry_entity_1 = require("./entities/question-bank-entry.entity");
const question_bank_service_1 = require("./question-bank.service");
describe('QuestionBankService (integration)', () => {
    let service;
    let tkus;
    let plans;
    let slots;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            imports: [
                typeorm_1.TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity, question_plan_entity_1.QuestionPlanEntity, question_slot_entity_1.QuestionSlotEntity, question_bank_entry_entity_1.QuestionBankEntryEntity],
                    synchronize: true,
                }),
                typeorm_1.TypeOrmModule.forFeature([topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity, question_plan_entity_1.QuestionPlanEntity, question_slot_entity_1.QuestionSlotEntity, question_bank_entry_entity_1.QuestionBankEntryEntity]),
            ],
            providers: [question_bank_service_1.QuestionBankService],
        }).compile();
        service = module.get(question_bank_service_1.QuestionBankService);
        tkus = module.get((0, typeorm_1.getRepositoryToken)(topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity));
        plans = module.get((0, typeorm_1.getRepositoryToken)(question_plan_entity_1.QuestionPlanEntity));
        slots = module.get((0, typeorm_1.getRepositoryToken)(question_slot_entity_1.QuestionSlotEntity));
    });
    async function seedPlan(userId = 'user-1') {
        const tku = await tkus.save(tkus.create({
            userId,
            topic: 'Contract Law',
            subtopic: 'Offer',
            summary: 'Offer under contract law.',
            definitions: [{ id: 'd1', term: 'Proposal', definitionText: 'willingness', definitionType: 'statutory', sourceRefs: [{ documentId: 'doc-1', entityId: 'd1', sectionId: 's1', sourceType: 'document' }] }],
            legalProvisions: [{ id: 'p1', text: 'Section 2(a) defines proposal.', normalizedKey: 'section 2 a', sourceRefs: [{ documentId: 'doc-1', entityId: 'p1', sectionId: 's1', sourceType: 'document' }] }],
            principles: [{ id: 'pr1', text: 'Offer must be communicated.', constructType: 'principle', sourceRefs: [{ documentId: 'doc-2', entityId: 'pr1', sectionId: 's2', sourceType: 'document' }] }],
            exceptions: [{ id: 'e1', text: 'Invitation to offer is not an offer.', qualifiesPrincipleId: 'pr1', sourceRefs: [{ documentId: 'doc-2', entityId: 'e1', sectionId: 's2', sourceType: 'document' }] }],
            landmarkCases: [{ id: 'c1', caseName: 'Carlill v Carbolic Smoke Ball Co', court: null, year: '1893', structured: { held: 'Reward advertisement can be offer.' }, isLandmark: true, isReferenced: false, sourceRefs: [{ documentId: 'doc-3', entityId: 'c1', sectionId: 's3', sourceType: 'document' }] }],
            referencedCases: [],
            illustrations: [{ id: 'i1', text: 'Reward advertisement example.', exampleType: 'instructional_hypothetical', illustratesEntityId: 'd1', sourceRefs: [{ documentId: 'doc-3', entityId: 'i1', sectionId: 's3', sourceType: 'document' }] }],
            examples: [],
            comparisons: [{ id: 'cmp1', leftEntityId: 'd1', rightEntityId: 'pr1', axis: 'communication', sourceRefs: [{ documentId: 'doc-2', entityId: 'cmp1', sectionId: 's2', sourceType: 'document' }] }],
            keywords: [{ value: 'offer', weight: 1 }],
            references: [{ documentId: 'doc-1', sourceType: 'document' }],
            coverageScore: 0.9,
            confidenceScore: 0.86,
        }));
        const plan = await plans.save(plans.create({
            userId,
            status: 'ready',
            coverageMatrix: [],
            markDistribution: [],
            typeDistribution: [],
            questionRequirements: [],
            summary: { totalSlots: 2, totalMarks: 15, topicCount: 1, generatedFromTkuVersions: { [tku.id]: tku.version || 1 } },
        }));
        await slots.save([
            slots.create({
                userId,
                planId: plan.id,
                tkuId: tku.id,
                topic: tku.topic,
                subtopic: tku.subtopic,
                questionType: 'short',
                markValue: 5,
                slotIndex: 1,
                eligibilityScore: 0.9,
                requiredEntityRefs: ['definition_or_provision'],
                requirements: {},
                status: 'planned',
            }),
            slots.create({
                userId,
                planId: plan.id,
                tkuId: tku.id,
                topic: tku.topic,
                subtopic: tku.subtopic,
                questionType: 'case_based',
                markValue: 10,
                slotIndex: 1,
                eligibilityScore: 0.88,
                requiredEntityRefs: ['case'],
                requirements: {},
                status: 'planned',
            }),
        ]);
        return { plan, tku };
    }
    it('creates reusable question bank entries from planned slots', async () => {
        await seedPlan();
        const summary = await service.createQuestionBank('user-1');
        const entries = await service.listForUser('user-1');
        expect(summary.generated).toBe(2);
        expect(summary.valid).toBe(2);
        expect(entries).toHaveLength(2);
        expect(entries[0].question).toBeTruthy();
        expect(entries[0].rubric.reduce((sum, item) => sum + item.marks, 0)).toBe(entries[0].markValue);
        expect(entries[0].boundEntityRefs.length).toBeGreaterThan(0);
        expect(entries[0].groundingSources.length).toBeGreaterThan(0);
        expect(entries[0].qualityScore).toBeGreaterThan(0);
        expect(entries.every((entry) => !('paperId' in entry))).toBe(true);
    });
    it('upserts entries by slot instead of duplicating the question bank', async () => {
        await seedPlan();
        await service.createQuestionBank('user-1');
        await service.createQuestionBank('user-1');
        expect(await service.listForUser('user-1')).toHaveLength(2);
    });
    it('keeps question banks isolated by user', async () => {
        await seedPlan('user-1');
        await seedPlan('user-2');
        await service.createQuestionBank('user-1');
        expect(await service.listForUser('user-1')).toHaveLength(2);
        expect(await service.listForUser('user-2')).toHaveLength(0);
    });
    it('regenerates duplicate drafts until a unique accepted question is produced', async () => {
        const { plan, tku } = await seedPlan();
        await slots.save(slots.create({
            userId: 'user-1',
            planId: plan.id,
            tkuId: tku.id,
            topic: tku.topic,
            subtopic: tku.subtopic,
            questionType: 'short',
            markValue: 5,
            slotIndex: 2,
            eligibilityScore: 0.9,
            requiredEntityRefs: ['definition_or_provision'],
            requirements: {},
            status: 'planned',
        }));
        const summary = await service.createQuestionBank('user-1');
        const entries = await service.listForUser('user-1');
        const uniqueQuestions = new Set(entries.map((entry) => entry.question));
        expect(entries).toHaveLength(3);
        expect(uniqueQuestions.size).toBe(3);
        expect(summary.rejected).toBeGreaterThan(0);
        expect(entries.every((entry) => entry.validationStatus === 'valid')).toBe(true);
    });
    it('does not permanently store drafts that fail grounding validation after regeneration attempts', async () => {
        const tku = await tkus.save(tkus.create({
            userId: 'user-1',
            topic: 'Contract Law',
            subtopic: 'Consideration',
            summary: 'Sparse ungrounded TKU.',
            definitions: [{ id: 'd1', term: 'Consideration', definitionText: 'price of promise', definitionType: 'descriptive', sourceRefs: [] }],
            legalProvisions: [],
            principles: [],
            exceptions: [],
            landmarkCases: [],
            referencedCases: [],
            illustrations: [],
            examples: [],
            comparisons: [],
            keywords: [],
            references: [],
            coverageScore: 0.6,
            confidenceScore: 0.8,
        }));
        const plan = await plans.save(plans.create({
            userId: 'user-1',
            status: 'ready',
            coverageMatrix: [],
            markDistribution: [],
            typeDistribution: [],
            questionRequirements: [],
            summary: { totalSlots: 1, totalMarks: 5, topicCount: 1, generatedFromTkuVersions: { [tku.id]: tku.version || 1 } },
        }));
        await slots.save(slots.create({
            userId: 'user-1',
            planId: plan.id,
            tkuId: tku.id,
            topic: tku.topic,
            subtopic: tku.subtopic,
            questionType: 'short',
            markValue: 5,
            slotIndex: 1,
            eligibilityScore: 0.8,
            requiredEntityRefs: ['definition_or_provision'],
            requirements: {},
            status: 'planned',
        }));
        const summary = await service.createQuestionBank('user-1');
        expect(summary.generated).toBe(0);
        expect(summary.rejected).toBe(5);
        expect(summary.attempts).toBe(5);
        expect(await service.listForUser('user-1')).toHaveLength(0);
    });
});
//# sourceMappingURL=question-bank.service.spec.js.map