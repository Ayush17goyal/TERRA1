"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const topic_knowledge_unit_entity_1 = require("../knowledge-engine/entities/topic-knowledge-unit.entity");
const question_plan_entity_1 = require("./entities/question-plan.entity");
const question_slot_entity_1 = require("./entities/question-slot.entity");
const question_planning_service_1 = require("./question-planning.service");
const question_planning_types_1 = require("./question-planning.types");
describe('QuestionPlanningService (integration)', () => {
    let service;
    let tkus;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            imports: [
                typeorm_1.TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity, question_plan_entity_1.QuestionPlanEntity, question_slot_entity_1.QuestionSlotEntity],
                    synchronize: true,
                }),
                typeorm_1.TypeOrmModule.forFeature([topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity, question_plan_entity_1.QuestionPlanEntity, question_slot_entity_1.QuestionSlotEntity]),
            ],
            providers: [question_planning_service_1.QuestionPlanningService],
        }).compile();
        service = module.get(question_planning_service_1.QuestionPlanningService);
        tkus = module.get((0, typeorm_1.getRepositoryToken)(topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity));
    });
    async function seedRichTku(userId = 'user-1') {
        return tkus.save(tkus.create({
            userId,
            topic: 'Contract Law',
            subtopic: 'Offer',
            summary: 'Offer under contract law.',
            definitions: [{ id: 'd1', term: 'Proposal', definitionText: 'willingness', definitionType: 'statutory', sourceRefs: [] }],
            legalProvisions: [{ id: 'p1', text: 'Section 2(a)', normalizedKey: 'section 2 a', sourceRefs: [] }],
            principles: [{ id: 'pr1', text: 'Offer must be communicated.', constructType: 'principle', sourceRefs: [] }],
            exceptions: [{ id: 'e1', text: 'Invitation to offer is not an offer.', qualifiesPrincipleId: 'pr1', sourceRefs: [] }],
            landmarkCases: [{ id: 'c1', caseName: 'Carlill v Carbolic Smoke Ball Co', court: null, year: '1893', structured: { held: 'Reward advertisement can be offer.' }, isLandmark: true, isReferenced: false, sourceRefs: [] }],
            referencedCases: [{ id: 'c2', caseName: 'Lalman Shukla v Gauri Dutt', court: null, year: '1913', structured: null, isLandmark: false, isReferenced: true, sourceRefs: [] }],
            illustrations: [{ id: 'i1', text: 'Reward advertisement example.', exampleType: 'instructional_hypothetical', illustratesEntityId: 'd1', sourceRefs: [] }],
            examples: [{ id: 'ex1', text: 'For example, A offers reward.', exampleType: 'section_example', illustratesEntityId: null, sourceRefs: [] }],
            comparisons: [{ id: 'cmp1', leftEntityId: 'd1', rightEntityId: 'pr1', axis: 'communication', sourceRefs: [] }],
            keywords: [{ value: 'offer', weight: 1 }],
            references: [{ documentId: 'doc-1', sourceType: 'document' }, { documentId: 'doc-2', sourceType: 'document' }, { documentId: 'doc-3', sourceType: 'document' }],
            coverageScore: 0.9,
            confidenceScore: 0.86,
        }));
    }
    it('builds a complete coverage matrix and persists question slots without generating questions', async () => {
        await seedRichTku();
        const plan = await service.buildPlan('user-1');
        const slots = await service.getSlots('user-1');
        expect(plan.status).toBe('ready');
        expect(plan.coverageMatrix).toHaveLength(1);
        expect(plan.coverageMatrix[0].cells).toHaveLength(question_planning_types_1.QUESTION_MARK_VALUES.length * question_planning_types_1.QUESTION_TYPES.length);
        expect(plan.questionRequirements.every((req) => !('questionText' in req))).toBe(true);
        expect(slots.length).toBeGreaterThan(0);
        expect(slots.every((slot) => slot.status === 'planned')).toBe(true);
        expect(plan.markDistribution.reduce((sum, row) => sum + row.plannedSlots, 0)).toBe(slots.length);
    });
    it('records blocked requirements for sparse TKUs', async () => {
        await tkus.save(tkus.create({
            userId: 'user-1',
            topic: 'Torts',
            subtopic: 'Negligence',
            summary: '',
            definitions: [],
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
            coverageScore: 0.1,
            confidenceScore: 0.7,
        }));
        const plan = await service.buildPlan('user-1');
        expect(plan.summary.totalSlots).toBe(0);
        expect(plan.coverageMatrix[0].blockedCells).toBe(question_planning_types_1.QUESTION_MARK_VALUES.length * question_planning_types_1.QUESTION_TYPES.length);
        expect(plan.coverageMatrix[0].cells.some((cell) => cell.missingRequirements.length > 0)).toBe(true);
    });
    it('keeps plans and slots isolated by user', async () => {
        await seedRichTku('user-1');
        await seedRichTku('user-2');
        await service.buildPlan('user-1');
        expect(await service.getSlots('user-1')).not.toHaveLength(0);
        await expect(service.getPlan('user-2')).rejects.toThrow('Question plan not found');
    });
});
//# sourceMappingURL=question-planning.service.spec.js.map