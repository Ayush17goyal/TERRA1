import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopicKnowledgeUnitEntity } from '../knowledge-engine/entities/topic-knowledge-unit.entity';
import { QuestionPlanEntity } from './entities/question-plan.entity';
import { QuestionSlotEntity } from './entities/question-slot.entity';
import {
  CoverageMatrixCell,
  CoverageMatrixRow,
  MarkDistributionEntry,
  PlannedQuestionType,
  QuestionMarkValue,
  QuestionRequirement,
  QUESTION_MARK_VALUES,
  QUESTION_TYPES,
  TypeDistributionEntry,
} from './question-planning.types';

interface EntityCounts {
  definitions: number;
  provisions: number;
  principles: number;
  exceptions: number;
  comparisons: number;
  landmarkCases: number;
  referencedCases: number;
  cases: number;
  illustrations: number;
  examples: number;
  references: number;
}

@Injectable()
export class QuestionPlanningService {
  constructor(
    @InjectRepository(TopicKnowledgeUnitEntity)
    private readonly tkus: Repository<TopicKnowledgeUnitEntity>,
    @InjectRepository(QuestionPlanEntity)
    private readonly plans: Repository<QuestionPlanEntity>,
    @InjectRepository(QuestionSlotEntity)
    private readonly slots: Repository<QuestionSlotEntity>,
  ) {}

  async buildPlan(userId: string): Promise<QuestionPlanEntity> {
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
    if (!plan) plan = this.plans.create({ userId });
    plan.status = tkus.length === 0 ? 'empty' : 'ready';
    plan.coverageMatrix = coverageMatrix;
    plan.markDistribution = markDistribution;
    plan.typeDistribution = typeDistribution;
    plan.questionRequirements = questionRequirements;
    plan.summary = summary;
    plan = await this.plans.save(plan);

    await this.slots.delete({ userId, planId: plan.id });
    const slotEntities = this.buildSlots(userId, plan.id, questionRequirements);
    if (slotEntities.length > 0) await this.slots.save(slotEntities);
    return this.getPlan(userId);
  }

  async getPlan(userId: string): Promise<QuestionPlanEntity> {
    const plan = await this.plans.findOne({ where: { userId } });
    if (!plan) throw new NotFoundException('Question plan not found. Build a plan first.');
    return plan;
  }

  async getSlots(userId: string): Promise<QuestionSlotEntity[]> {
    const plan = await this.getPlan(userId);
    return this.slots.find({ where: { userId, planId: plan.id }, order: { topic: 'ASC', subtopic: 'ASC', markValue: 'ASC', questionType: 'ASC', slotIndex: 'ASC' } });
  }

  async getCoverageMatrix(userId: string): Promise<CoverageMatrixRow[]> {
    return (await this.getPlan(userId)).coverageMatrix;
  }

  private buildCoverageRow(tku: TopicKnowledgeUnitEntity): CoverageMatrixRow {
    const cells: CoverageMatrixCell[] = [];
    for (const markValue of QUESTION_MARK_VALUES) {
      for (const questionType of QUESTION_TYPES) {
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

  private evaluateRequirement(
    tku: TopicKnowledgeUnitEntity,
    questionType: PlannedQuestionType,
    markValue: QuestionMarkValue,
  ): QuestionRequirement {
    const counts = this.countEntities(tku);
    const requiredEntityTypes = this.requiredEntityTypes(questionType, markValue);
    const missingRequirements = requiredEntityTypes.filter((type) => this.countForType(counts, type) < this.minimumFor(questionType, markValue, type));
    const depthMissing = this.depthScore(counts) < this.depthThreshold(markValue);
    const confidenceMissing = (tku.confidenceScore || 0) < 0.35;
    if (depthMissing) missingRequirements.push(`depth:${this.depthThreshold(markValue)}`);
    if (confidenceMissing) missingRequirements.push('confidence:0.35');

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
      availableEntityCounts: counts as any,
      missingRequirements,
      recommendedSlotCount: eligible ? this.slotCount(tku, questionType, markValue, eligibilityScore) : 0,
      eligibilityScore,
    };
  }

  private countEntities(tku: TopicKnowledgeUnitEntity): EntityCounts {
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

  private requiredEntityTypes(questionType: PlannedQuestionType, markValue: QuestionMarkValue): string[] {
    const base: Record<PlannedQuestionType, string[]> = {
      short: ['definition_or_provision'],
      long: ['definition_or_provision', 'principle_or_provision'],
      analytical: ['principle_or_provision', 'exception_or_case'],
      comparative: ['comparison'],
      critical: ['principle_or_provision', 'landmark_case_or_exception'],
      case_based: ['case'],
      problem_based: ['principle_or_provision', 'example_or_illustration'],
    };
    const required = [...base[questionType]];
    if (markValue >= 15 && !required.includes('reference_depth')) required.push('reference_depth');
    if (markValue === 20 && !required.includes('multi_entity_depth')) required.push('multi_entity_depth');
    return required;
  }

  private minimumFor(questionType: PlannedQuestionType, markValue: QuestionMarkValue, type: string): number {
    if (type === 'reference_depth') return markValue >= 20 ? 3 : 2;
    if (type === 'multi_entity_depth') return questionType === 'short' ? 2 : 3;
    if (markValue <= 10) return 1;
    return markValue === 15 ? 2 : 3;
  }

  private countForType(counts: EntityCounts, type: string): number {
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

  private depthScore(counts: EntityCounts): number {
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

  private depthThreshold(markValue: QuestionMarkValue): number {
    if (markValue === 5) return 1;
    if (markValue === 10) return 2;
    if (markValue === 15) return 3;
    return 4;
  }

  private eligibilityScore(
    tku: TopicKnowledgeUnitEntity,
    counts: EntityCounts,
    questionType: PlannedQuestionType,
    markValue: QuestionMarkValue,
    missingRequirements: string[],
  ): number {
    const requirementCount = this.requiredEntityTypes(questionType, markValue)
      .map((type) => Math.min(1, this.countForType(counts, type) / Math.max(1, this.minimumFor(questionType, markValue, type))))
      .reduce((sum, score) => sum + score, 0);
    const maxRequirements = this.requiredEntityTypes(questionType, markValue).length || 1;
    const requirementScore = requirementCount / maxRequirements;
    const penalty = missingRequirements.length * 0.08;
    return this.round((tku.coverageScore || 0) * 0.35 + (tku.confidenceScore || 0) * 0.25 + requirementScore * 0.4 - penalty);
  }

  private slotCount(
    tku: TopicKnowledgeUnitEntity,
    questionType: PlannedQuestionType,
    markValue: QuestionMarkValue,
    eligibilityScore: number,
  ): number {
    const base = 1;
    const highDepthBonus = (tku.coverageScore || 0) >= 0.75 && eligibilityScore >= 0.75 && markValue <= 10 ? 1 : 0;
    const caseBonus = questionType === 'case_based' && (tku.landmarkCases?.length || 0) >= 2 ? 1 : 0;
    return Math.min(3, base + highDepthBonus + caseBonus);
  }

  private buildMarkDistribution(requirements: QuestionRequirement[]): MarkDistributionEntry[] {
    const grouped = new Map<string, MarkDistributionEntry>();
    for (const req of requirements.filter((r) => r.eligible)) {
      const key = `${req.topic}\u0000${req.subtopic}\u0000${req.markValue}`;
      const current = grouped.get(key) || { topic: req.topic, subtopic: req.subtopic, markValue: req.markValue, plannedSlots: 0, plannedMarks: 0 };
      current.plannedSlots += req.recommendedSlotCount;
      current.plannedMarks += req.recommendedSlotCount * req.markValue;
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => a.topic.localeCompare(b.topic) || a.subtopic.localeCompare(b.subtopic) || a.markValue - b.markValue);
  }

  private buildTypeDistribution(requirements: QuestionRequirement[]): TypeDistributionEntry[] {
    const grouped = new Map<PlannedQuestionType, TypeDistributionEntry>();
    for (const req of requirements.filter((r) => r.eligible)) {
      const current = grouped.get(req.questionType) || { questionType: req.questionType, plannedSlots: 0, plannedMarks: 0 };
      current.plannedSlots += req.recommendedSlotCount;
      current.plannedMarks += req.recommendedSlotCount * req.markValue;
      grouped.set(req.questionType, current);
    }
    return [...grouped.values()].sort((a, b) => a.questionType.localeCompare(b.questionType));
  }

  private buildSlots(userId: string, planId: string, requirements: QuestionRequirement[]): QuestionSlotEntity[] {
    const slots: QuestionSlotEntity[] = [];
    for (const req of requirements.filter((r) => r.eligible && r.recommendedSlotCount > 0)) {
      for (let index = 1; index <= req.recommendedSlotCount; index++) {
        slots.push(
          this.slots.create({
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
          }),
        );
      }
    }
    return slots;
  }

  private round(value: number): number {
    return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
  }
}
