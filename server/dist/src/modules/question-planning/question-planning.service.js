"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionPlanningService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const topic_knowledge_unit_entity_1 = require("../knowledge-engine/entities/topic-knowledge-unit.entity");
const question_plan_entity_1 = require("./entities/question-plan.entity");
const question_slot_entity_1 = require("./entities/question-slot.entity");
const question_planning_types_1 = require("./question-planning.types");
let QuestionPlanningService = class QuestionPlanningService {
    constructor(tkus, plans, slots) {
        this.tkus = tkus;
        this.plans = plans;
        this.slots = slots;
    }
    async buildPlan(userId) {
        const tkus = await this.tkus.find({ where: { userId }, order: { topic: 'ASC', subtopic: 'ASC' } });
        const coverageMatrix = tkus.map((tku) => this.buildCoverageRow(tku));
        const questionRequirements = coverageMatrix.flatMap((row) => row.cells);
        const markDistribution = this.buildMarkDistribution(questionRequirements);
        const typeDistribution = this.buildTypeDistribution(questionRequirements);
        const summary = {
            totalSlots: questionRequirements.reduce((sum, req) => sum + req.recommendedSlotCount, 0),
            totalMarks: questionRequirements.reduce((sum, req) => sum + req.recommendedSlotCount * req.markValue, 0),
            topicCount: new Set(tkus.map((tku) => tku.topic)).size,
            generatedFromTkuVersions: Object.fromEntries(tkus.map((tku) => [tku.id, tku.version || 1])),
        };
        let plan = await this.plans.findOne({ where: { userId } });
        if (!plan)
            plan = this.plans.create({ userId });
        plan.status = tkus.length === 0 ? 'empty' : 'ready';
        plan.coverageMatrix = coverageMatrix;
        plan.markDistribution = markDistribution;
        plan.typeDistribution = typeDistribution;
        plan.questionRequirements = questionRequirements;
        plan.summary = summary;
        plan = await this.plans.save(plan);
        await this.slots.delete({ userId, planId: plan.id });
        const slotEntities = this.buildSlots(userId, plan.id, questionRequirements);
        if (slotEntities.length > 0)
            await this.slots.save(slotEntities);
        return this.getPlan(userId);
    }
    async getPlan(userId) {
        const plan = await this.plans.findOne({ where: { userId } });
        if (!plan)
            throw new common_1.NotFoundException('Question plan not found. Build a plan first.');
        return plan;
    }
    async getSlots(userId) {
        const plan = await this.getPlan(userId);
        return this.slots.find({ where: { userId, planId: plan.id }, order: { topic: 'ASC', subtopic: 'ASC', markValue: 'ASC', questionType: 'ASC', slotIndex: 'ASC' } });
    }
    async getCoverageMatrix(userId) {
        return (await this.getPlan(userId)).coverageMatrix;
    }
    buildCoverageRow(tku) {
        const cells = [];
        for (const markValue of question_planning_types_1.QUESTION_MARK_VALUES) {
            for (const questionType of question_planning_types_1.QUESTION_TYPES) {
                cells.push(this.evaluateRequirement(tku, questionType, markValue));
            }
        }
        const eligibleCells = cells.filter((cell) => cell.eligible).length;
        return {
            tkuId: tku.id,
            topic: tku.topic,
            subtopic: tku.subtopic,
            coverageScore: this.round(tku.coverageScore || 0),
            confidenceScore: this.round(tku.confidenceScore || 0),
            eligibleCells,
            blockedCells: cells.length - eligibleCells,
            cells,
        };
    }
    evaluateRequirement(tku, questionType, markValue) {
        const counts = this.countEntities(tku);
        const requiredEntityTypes = this.requiredEntityTypes(questionType, markValue);
        const missingRequirements = requiredEntityTypes.filter((type) => this.countForType(counts, type) < this.minimumFor(questionType, markValue, type));
        const depthMissing = this.depthScore(counts) < this.depthThreshold(markValue);
        const confidenceMissing = (tku.confidenceScore || 0) < 0.35;
        if (depthMissing)
            missingRequirements.push(`depth:${this.depthThreshold(markValue)}`);
        if (confidenceMissing)
            missingRequirements.push('confidence:0.35');
        const eligible = missingRequirements.length === 0;
        const eligibilityScore = this.eligibilityScore(tku, counts, questionType, markValue, missingRequirements);
        return {
            tkuId: tku.id,
            topic: tku.topic,
            subtopic: tku.subtopic,
            questionType,
            markValue,
            eligible,
            requiredEntityTypes,
            availableEntityCounts: counts,
            missingRequirements,
            recommendedSlotCount: eligible ? this.slotCount(tku, questionType, markValue, eligibilityScore) : 0,
            eligibilityScore,
        };
    }
    countEntities(tku) {
        const landmarkCases = tku.landmarkCases?.length || 0;
        const referencedCases = tku.referencedCases?.length || 0;
        return {
            definitions: tku.definitions?.length || 0,
            provisions: tku.legalProvisions?.length || 0,
            principles: tku.principles?.length || 0,
            exceptions: tku.exceptions?.length || 0,
            comparisons: tku.comparisons?.length || 0,
            landmarkCases,
            referencedCases,
            cases: landmarkCases + referencedCases,
            illustrations: tku.illustrations?.length || 0,
            examples: tku.examples?.length || 0,
            references: tku.references?.length || 0,
        };
    }
    requiredEntityTypes(questionType, markValue) {
        const base = {
            short: ['definition_or_provision'],
            long: ['definition_or_provision', 'principle_or_provision'],
            analytical: ['principle_or_provision', 'exception_or_case'],
            comparative: ['comparison'],
            critical: ['principle_or_provision', 'landmark_case_or_exception'],
            case_based: ['case'],
            problem_based: ['principle_or_provision', 'example_or_illustration'],
        };
        const required = [...base[questionType]];
        if (markValue >= 15 && !required.includes('reference_depth'))
            required.push('reference_depth');
        if (markValue === 20 && !required.includes('multi_entity_depth'))
            required.push('multi_entity_depth');
        return required;
    }
    minimumFor(questionType, markValue, type) {
        if (type === 'reference_depth')
            return markValue >= 20 ? 3 : 2;
        if (type === 'multi_entity_depth')
            return questionType === 'short' ? 2 : 3;
        if (markValue <= 10)
            return 1;
        return markValue === 15 ? 2 : 3;
    }
    countForType(counts, type) {
        switch (type) {
            case 'definition_or_provision':
                return counts.definitions + counts.provisions;
            case 'principle_or_provision':
                return counts.principles + counts.provisions;
            case 'exception_or_case':
                return counts.exceptions + counts.cases;
            case 'landmark_case_or_exception':
                return counts.landmarkCases + counts.exceptions;
            case 'example_or_illustration':
                return counts.examples + counts.illustrations;
            case 'comparison':
                return counts.comparisons;
            case 'case':
                return counts.cases;
            case 'reference_depth':
                return counts.references;
            case 'multi_entity_depth':
                return this.depthScore(counts);
            default:
                return 0;
        }
    }
    depthScore(counts) {
        return [
            counts.definitions,
            counts.provisions,
            counts.principles,
            counts.exceptions,
            counts.cases,
            counts.comparisons,
            counts.examples + counts.illustrations,
        ].filter((count) => count > 0).length;
    }
    depthThreshold(markValue) {
        if (markValue === 5)
            return 1;
        if (markValue === 10)
            return 2;
        if (markValue === 15)
            return 3;
        return 4;
    }
    eligibilityScore(tku, counts, questionType, markValue, missingRequirements) {
        const requirementCount = this.requiredEntityTypes(questionType, markValue)
            .map((type) => Math.min(1, this.countForType(counts, type) / Math.max(1, this.minimumFor(questionType, markValue, type))))
            .reduce((sum, score) => sum + score, 0);
        const maxRequirements = this.requiredEntityTypes(questionType, markValue).length || 1;
        const requirementScore = requirementCount / maxRequirements;
        const penalty = missingRequirements.length * 0.08;
        return this.round((tku.coverageScore || 0) * 0.35 + (tku.confidenceScore || 0) * 0.25 + requirementScore * 0.4 - penalty);
    }
    slotCount(tku, questionType, markValue, eligibilityScore) {
        const base = 1;
        const highDepthBonus = (tku.coverageScore || 0) >= 0.75 && eligibilityScore >= 0.75 && markValue <= 10 ? 1 : 0;
        const caseBonus = questionType === 'case_based' && (tku.landmarkCases?.length || 0) >= 2 ? 1 : 0;
        return Math.min(3, base + highDepthBonus + caseBonus);
    }
    buildMarkDistribution(requirements) {
        const grouped = new Map();
        for (const req of requirements.filter((r) => r.eligible)) {
            const key = `${req.topic}\u0000${req.subtopic}\u0000${req.markValue}`;
            const current = grouped.get(key) || { topic: req.topic, subtopic: req.subtopic, markValue: req.markValue, plannedSlots: 0, plannedMarks: 0 };
            current.plannedSlots += req.recommendedSlotCount;
            current.plannedMarks += req.recommendedSlotCount * req.markValue;
            grouped.set(key, current);
        }
        return [...grouped.values()].sort((a, b) => a.topic.localeCompare(b.topic) || a.subtopic.localeCompare(b.subtopic) || a.markValue - b.markValue);
    }
    buildTypeDistribution(requirements) {
        const grouped = new Map();
        for (const req of requirements.filter((r) => r.eligible)) {
            const current = grouped.get(req.questionType) || { questionType: req.questionType, plannedSlots: 0, plannedMarks: 0 };
            current.plannedSlots += req.recommendedSlotCount;
            current.plannedMarks += req.recommendedSlotCount * req.markValue;
            grouped.set(req.questionType, current);
        }
        return [...grouped.values()].sort((a, b) => a.questionType.localeCompare(b.questionType));
    }
    buildSlots(userId, planId, requirements) {
        const slots = [];
        for (const req of requirements.filter((r) => r.eligible && r.recommendedSlotCount > 0)) {
            for (let index = 1; index <= req.recommendedSlotCount; index++) {
                slots.push(this.slots.create({
                    userId,
                    planId,
                    tkuId: req.tkuId,
                    topic: req.topic,
                    subtopic: req.subtopic,
                    questionType: req.questionType,
                    markValue: req.markValue,
                    slotIndex: index,
                    eligibilityScore: req.eligibilityScore,
                    requiredEntityRefs: req.requiredEntityTypes,
                    requirements: req,
                    status: 'planned',
                }));
            }
        }
        return slots;
    }
    round(value) {
        return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
    }
};
exports.QuestionPlanningService = QuestionPlanningService;
exports.QuestionPlanningService = QuestionPlanningService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(question_plan_entity_1.QuestionPlanEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(question_slot_entity_1.QuestionSlotEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], QuestionPlanningService);
//# sourceMappingURL=question-planning.service.js.map