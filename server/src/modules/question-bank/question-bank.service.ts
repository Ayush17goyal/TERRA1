import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopicKnowledgeUnitEntity } from '../knowledge-engine/entities/topic-knowledge-unit.entity';
import {
  CaseRecord,
  ComparisonRecord,
  DefinitionRecord,
  ExampleRecord,
  ExceptionRecord,
  PrincipleRecord,
  ProvisionRecord,
  SourceReference,
} from '../knowledge-engine/knowledge-engine.types';
import { QuestionPlanEntity } from '../question-planning/entities/question-plan.entity';
import { QuestionSlotEntity } from '../question-planning/entities/question-slot.entity';
import { PlannedQuestionType, QuestionMarkValue } from '../question-planning/question-planning.types';
import { QuestionBankEntryEntity } from './entities/question-bank-entry.entity';
import {
  BoundEntityReference,
  QuestionBankGenerationSummary,
  QuestionDifficulty,
  QuestionValidationStatus,
  ReusableQuestionDraft,
  RubricComponent,
  ValidationCheckResult,
} from './question-bank.types';

type EntityBundle = {
  definitions: DefinitionRecord[];
  provisions: ProvisionRecord[];
  principles: PrincipleRecord[];
  exceptions: ExceptionRecord[];
  cases: CaseRecord[];
  comparisons: ComparisonRecord[];
  examples: ExampleRecord[];
};

type ValidationInput = {
  question: string;
  rubric: RubricComponent[];
  refs: BoundEntityReference[];
  sources: SourceReference[];
  slot: QuestionSlotEntity;
  tku: TopicKnowledgeUnitEntity;
  difficulty: QuestionDifficulty;
  qualityScore: number;
  existingQuestions: QuestionBankEntryEntity[];
  acceptedDrafts: ReusableQuestionDraft[];
};

@Injectable()
export class QuestionBankService {
  private readonly maxValidationAttempts = 5;

  constructor(
    @InjectRepository(QuestionPlanEntity)
    private readonly plans: Repository<QuestionPlanEntity>,
    @InjectRepository(QuestionSlotEntity)
    private readonly slots: Repository<QuestionSlotEntity>,
    @InjectRepository(TopicKnowledgeUnitEntity)
    private readonly tkus: Repository<TopicKnowledgeUnitEntity>,
    @InjectRepository(QuestionBankEntryEntity)
    private readonly bank: Repository<QuestionBankEntryEntity>,
  ) {}

  async createQuestionBank(userId: string): Promise<QuestionBankGenerationSummary> {
    const plan = await this.plans.findOne({ where: { userId } });
    if (!plan) throw new NotFoundException('Question plan not found. Build Module 3A first.');

    const slots = await this.slots.find({
      where: { userId, planId: plan.id },
      order: { topic: 'ASC', subtopic: 'ASC', markValue: 'ASC', questionType: 'ASC', slotIndex: 'ASC' },
    });
    const tkus = await this.tkus.find({ where: { userId } });
    const tkuById = new Map(tkus.map((tku) => [tku.id, tku]));

    const entries: QuestionBankEntryEntity[] = [];
    const acceptedDrafts: ReusableQuestionDraft[] = [];
    let attempts = 0;
    let rejected = 0;

    for (const slot of slots) {
      const tku = tkuById.get(slot.tkuId);
      if (!tku) continue;
      const existing = await this.bank.findOne({ where: { userId, slotId: slot.id } });
      const existingQuestions = await this.bank.find({ where: { userId, topic: slot.topic, subtopic: slot.subtopic } });
      const generated = this.generateAcceptedDraft(slot, tku, existingQuestions, acceptedDrafts);
      attempts += generated.attempts;
      rejected += generated.rejected;
      if (!generated.draft) continue;
      acceptedDrafts.push(generated.draft);
      entries.push(this.entryFromDraft(existing, userId, plan.id, slot, tku, generated.draft));
    }

    if (entries.length > 0) await this.bank.save(entries);
    const all = await this.listForUser(userId);
    return {
      planId: plan.id,
      generated: all.length,
      valid: all.filter((entry) => entry.validationStatus === 'valid').length,
      needsReview: all.filter((entry) => entry.validationStatus === 'needs_review').length,
      rejected,
      attempts,
    };
  }

  async listForUser(userId: string): Promise<QuestionBankEntryEntity[]> {
    return this.bank.find({ where: { userId }, order: { topic: 'ASC', subtopic: 'ASC', markValue: 'ASC', questionType: 'ASC' } });
  }

  async getEntry(userId: string, id: string): Promise<QuestionBankEntryEntity> {
    const entry = await this.bank.findOne({ where: { userId, id } });
    if (!entry) throw new NotFoundException('Question bank entry not found');
    return entry;
  }

  private generateAcceptedDraft(
    slot: QuestionSlotEntity,
    tku: TopicKnowledgeUnitEntity,
    existingQuestions: QuestionBankEntryEntity[],
    acceptedDrafts: ReusableQuestionDraft[],
  ): { draft: ReusableQuestionDraft | null; attempts: number; rejected: number } {
    let rejected = 0;
    for (let attempt = 0; attempt < this.maxValidationAttempts; attempt++) {
      const draft = this.generateDraft(slot, tku, attempt, existingQuestions, acceptedDrafts);
      if (draft.validationStatus === 'valid') return { draft, attempts: attempt + 1, rejected };
      rejected++;
    }
    return { draft: null, attempts: this.maxValidationAttempts, rejected };
  }

  private entryFromDraft(
    existing: QuestionBankEntryEntity | null,
    userId: string,
    planId: string,
    slot: QuestionSlotEntity,
    tku: TopicKnowledgeUnitEntity,
    draft: ReusableQuestionDraft,
  ): QuestionBankEntryEntity {
    return this.bank.create({
      ...(existing || {}),
      userId,
      planId,
      slotId: slot.id,
      tkuId: tku.id,
      question: draft.question,
      questionType: draft.questionType,
      difficulty: draft.difficulty,
      topic: draft.topic,
      subtopic: draft.subtopic,
      markValue: draft.markValue,
      rubric: draft.rubric,
      boundEntityRefs: draft.boundEntityRefs,
      groundingSources: draft.groundingSources,
      qualityScore: draft.qualityScore,
      validationStatus: draft.validationStatus,
      validationReasons: draft.validationReasons,
      sourceTkuVersion: tku.version || 1,
    });
  }

  private generateDraft(
    slot: QuestionSlotEntity,
    tku: TopicKnowledgeUnitEntity,
    attempt: number,
    existingQuestions: QuestionBankEntryEntity[],
    acceptedDrafts: ReusableQuestionDraft[],
  ): ReusableQuestionDraft {
    const bundle = this.bundle(tku);
    const boundEntityRefs = this.bindEntities(slot.questionType, slot.markValue, tku, bundle, attempt);
    const groundingSources = this.collectGroundingSources(boundEntityRefs, bundle);
    const question = this.composeQuestion(slot, tku, boundEntityRefs, bundle, attempt);
    const rubric = this.buildRubric(slot, boundEntityRefs);
    const difficulty = this.difficulty(slot.questionType, slot.markValue);
    const qualityScore = this.qualityScore(tku, boundEntityRefs, groundingSources);
    const validation = this.validate({ question, rubric, refs: boundEntityRefs, sources: groundingSources, slot, tku, difficulty, qualityScore, existingQuestions, acceptedDrafts });

    return {
      question,
      questionType: slot.questionType,
      difficulty,
      topic: tku.topic,
      subtopic: tku.subtopic,
      markValue: slot.markValue,
      rubric,
      boundEntityRefs,
      groundingSources,
      qualityScore,
      validationStatus: validation.status,
      validationReasons: validation.reasons,
    };
  }

  private bundle(tku: TopicKnowledgeUnitEntity): EntityBundle {
    return {
      definitions: tku.definitions || [],
      provisions: tku.legalProvisions || [],
      principles: tku.principles || [],
      exceptions: tku.exceptions || [],
      cases: [...(tku.landmarkCases || []), ...(tku.referencedCases || [])],
      comparisons: tku.comparisons || [],
      examples: [...(tku.illustrations || []), ...(tku.examples || [])],
    };
  }

  private bindEntities(
    questionType: PlannedQuestionType,
    markValue: QuestionMarkValue,
    tku: TopicKnowledgeUnitEntity,
    bundle: EntityBundle,
    attempt: number,
  ): BoundEntityReference[] {
    const refs: BoundEntityReference[] = [];
    const rotate = <T>(items: T[]) => (items.length ? [...items.slice(attempt % items.length), ...items.slice(0, attempt % items.length)] : items);
    const add = (entity: any, entityType: string, label: string) => {
      if (!entity?.id || refs.some((ref) => ref.entityId === entity.id && ref.entityType === entityType)) return;
      refs.push({ entityId: entity.id, entityType, label: label || entity.id, tkuId: tku.id });
    };

    const definitions = rotate(bundle.definitions);
    const provisions = rotate(bundle.provisions);
    const principles = rotate(bundle.principles);
    const exceptions = rotate(bundle.exceptions);
    const cases = rotate(bundle.cases);
    const comparisons = rotate(bundle.comparisons);
    const examples = rotate(bundle.examples);

    if (['short', 'long'].includes(questionType)) {
      add(definitions[0], 'definition', definitions[0]?.term);
      add(provisions[0], 'provision', this.shortText(provisions[0]?.text));
    }
    if (['long', 'analytical', 'critical', 'problem_based'].includes(questionType)) {
      add(principles[0], 'principle', this.shortText(principles[0]?.text));
      add(provisions[0], 'provision', this.shortText(provisions[0]?.text));
    }
    if (questionType === 'analytical') {
      add(exceptions[0], 'exception', this.shortText(exceptions[0]?.text));
      add(cases[0], 'case', cases[0]?.caseName);
    }
    if (questionType === 'comparative') {
      const comparison = comparisons[0];
      add(comparison, 'comparison', comparison?.axis);
      this.addComparisonEndpoints(comparison, bundle, add);
    }
    if (questionType === 'critical') {
      add(exceptions[0], 'exception', this.shortText(exceptions[0]?.text));
      const selectedCase = cases.find((c) => c.isLandmark) || cases[0];
      add(selectedCase, 'case', selectedCase?.caseName);
    }
    if (questionType === 'case_based') {
      const selected = cases.find((c) => c.structured?.held || c.structured?.ratio) || cases[0];
      add(selected, 'case', selected?.caseName);
      add(principles[0], 'principle', this.shortText(principles[0]?.text));
    }
    if (questionType === 'problem_based') {
      add(examples[0], 'example', this.shortText(examples[0]?.text));
      add(principles[0], 'principle', this.shortText(principles[0]?.text));
      add(exceptions[0], 'exception', this.shortText(exceptions[0]?.text));
    }

    const minimum = markValue >= 20 ? 3 : markValue >= 15 ? 2 : 1;
    for (const fallback of [
      ...definitions.map((entity) => ({ entity, type: 'definition', label: entity.term })),
      ...provisions.map((entity) => ({ entity, type: 'provision', label: this.shortText(entity.text) })),
      ...principles.map((entity) => ({ entity, type: 'principle', label: this.shortText(entity.text) })),
      ...cases.map((entity) => ({ entity, type: 'case', label: entity.caseName })),
      ...examples.map((entity) => ({ entity, type: 'example', label: this.shortText(entity.text) })),
    ]) {
      if (refs.length >= minimum) break;
      add(fallback.entity, fallback.type, fallback.label);
    }
    return refs;
  }

  private addComparisonEndpoints(
    comparison: ComparisonRecord | undefined,
    bundle: EntityBundle,
    add: (entity: any, entityType: string, label: string) => void,
  ): void {
    if (!comparison) return;
    const all = [
      ...bundle.definitions.map((entity) => ({ entity, type: 'definition', label: entity.term })),
      ...bundle.principles.map((entity) => ({ entity, type: 'principle', label: this.shortText(entity.text) })),
      ...bundle.provisions.map((entity) => ({ entity, type: 'provision', label: this.shortText(entity.text) })),
    ];
    for (const targetId of [comparison.leftEntityId, comparison.rightEntityId]) {
      const found = all.find((item) => item.entity.id === targetId);
      if (found) add(found.entity, found.type, found.label);
    }
  }

  private collectGroundingSources(refs: BoundEntityReference[], bundle: EntityBundle): SourceReference[] {
    const sources = new Map<string, SourceReference>();
    for (const ref of refs) {
      const entity = this.findEntity(ref, bundle);
      for (const source of entity?.sourceRefs || []) {
        const key = `${source.documentId}:${source.sectionId || ''}:${source.entityId || ''}:${source.sourceType}`;
        sources.set(key, source);
      }
    }
    return [...sources.values()];
  }

  private findEntity(ref: BoundEntityReference, bundle: EntityBundle): any {
    const pools: Record<string, any[]> = {
      definition: bundle.definitions,
      provision: bundle.provisions,
      principle: bundle.principles,
      exception: bundle.exceptions,
      case: bundle.cases,
      comparison: bundle.comparisons,
      example: bundle.examples,
    };
    return (pools[ref.entityType] || []).find((entity) => entity.id === ref.entityId);
  }

  private composeQuestion(slot: QuestionSlotEntity, tku: TopicKnowledgeUnitEntity, refs: BoundEntityReference[], bundle: EntityBundle, attempt: number): string {
    const primary = refs[0]?.label || tku.subtopic;
    const secondary = refs[1]?.label || tku.topic;
    const caseName = refs.find((ref) => ref.entityType === 'case')?.label || bundle.cases[0]?.caseName;
    const variants: Record<PlannedQuestionType, string[]> = {
      short: [
        `What is ${primary} in the context of ${tku.subtopic}?`,
        `Briefly explain ${primary} under ${tku.subtopic} with its legal context.`,
        `State the legal meaning of ${primary} in ${tku.subtopic} under ${tku.topic}.`,
      ],
      long: [
        `Explain ${tku.subtopic} under ${tku.topic}, covering ${primary} and ${secondary}.`,
        `Discuss the legal framework for ${tku.subtopic} with reference to the relevant definition, provision, and principle.`,
        `Write a detailed note on ${tku.subtopic} using the available source-backed entities.`,
      ],
      analytical: [
        `Analyse the legal principle governing ${tku.subtopic}, including its exceptions and supporting authority.`,
        `How do the rule, exception, and authority interact in relation to ${tku.subtopic}?`,
        `Analyse ${tku.subtopic} by connecting the principle with the available case or exception.`,
      ],
      comparative: [
        `Compare the connected concepts in ${tku.subtopic} with reference to ${primary}.`,
        `Distinguish the linked concepts within ${tku.subtopic} on the axis of ${primary}.`,
        `How should the compared concepts in ${tku.subtopic} be differentiated in an exam answer?`,
      ],
      critical: [
        `Critically examine ${tku.subtopic} under ${tku.topic} with reference to exceptions and landmark authority.`,
        `Evaluate the strength and limits of the rule on ${tku.subtopic}.`,
        `Critically discuss ${tku.subtopic}, addressing both the governing principle and its limitation.`,
      ],
      case_based: [
        `Discuss ${caseName || 'the relevant case law'} and explain its significance for ${tku.subtopic}.`,
        `What principle does ${caseName || 'the selected case'} establish for ${tku.subtopic}?`,
        `Explain the relevance of ${caseName || 'the source-backed case'} to ${tku.subtopic}.`,
      ],
      problem_based: [
        `How would you apply the principles of ${tku.subtopic} to a problem scenario based on the provided illustration?`,
        `Apply ${tku.subtopic} to a hypothetical fact situation using ${primary}.`,
        `Using the source-backed example, how should a problem on ${tku.subtopic} be resolved?`,
      ],
    };
    return variants[slot.questionType][attempt % variants[slot.questionType].length];
  }

  private buildRubric(slot: QuestionSlotEntity, refs: BoundEntityReference[]): RubricComponent[] {
    const marks = slot.markValue;
    if (marks === 5) {
      return [
        { label: 'Core rule', marks: 3, criteria: 'State the central definition, provision, or principle accurately.', boundEntityRefs: refs.slice(0, 2).map((ref) => ref.entityId) },
        { label: 'Precision', marks: 2, criteria: 'Use topic-specific legal keywords and stay within the asked scope.', boundEntityRefs: refs.map((ref) => ref.entityId) },
      ];
    }
    if (marks === 10) {
      return [
        { label: 'Legal basis', marks: 4, criteria: 'Identify the relevant definition, provision, principle, or case.', boundEntityRefs: refs.slice(0, 3).map((ref) => ref.entityId) },
        { label: 'Explanation', marks: 4, criteria: 'Explain the rule and connect it to the subtopic.', boundEntityRefs: refs.map((ref) => ref.entityId) },
        { label: 'Conclusion', marks: 2, criteria: 'Conclude with a legally precise takeaway.', boundEntityRefs: refs.map((ref) => ref.entityId) },
      ];
    }
    if (marks === 15) {
      return [
        { label: 'Issue and legal framework', marks: 4, criteria: 'Set out the issue and governing legal framework.', boundEntityRefs: refs.slice(0, 3).map((ref) => ref.entityId) },
        { label: 'Doctrinal explanation', marks: 5, criteria: 'Explain principles, exceptions, and authorities in a connected manner.', boundEntityRefs: refs.map((ref) => ref.entityId) },
        { label: 'Application or analysis', marks: 4, criteria: 'Apply or analyse the source material according to the question type.', boundEntityRefs: refs.map((ref) => ref.entityId) },
        { label: 'Conclusion', marks: 2, criteria: 'Give a concise exam-style conclusion.', boundEntityRefs: refs.map((ref) => ref.entityId) },
      ];
    }
    return [
      { label: 'Introduction and issues', marks: 4, criteria: 'Frame the topic, issue, and relevant legal context.', boundEntityRefs: refs.slice(0, 3).map((ref) => ref.entityId) },
      { label: 'Rules and provisions', marks: 5, criteria: 'Explain provisions, definitions, and principles with source grounding.', boundEntityRefs: refs.map((ref) => ref.entityId) },
      { label: 'Authorities and exceptions', marks: 5, criteria: 'Use cases, exceptions, or comparisons where available.', boundEntityRefs: refs.map((ref) => ref.entityId) },
      { label: 'Analysis', marks: 4, criteria: 'Develop the analysis required by the question type.', boundEntityRefs: refs.map((ref) => ref.entityId) },
      { label: 'Conclusion', marks: 2, criteria: 'Conclude with a balanced legal position.', boundEntityRefs: refs.map((ref) => ref.entityId) },
    ];
  }

  private validate(input: ValidationInput): { status: QuestionValidationStatus; reasons: string[]; checks: ValidationCheckResult[] } {
    const checks: ValidationCheckResult[] = [
      this.validateStructural(input),
      this.validateGrounding(input),
      this.validateDuplicate(input),
      this.validateDifficulty(input),
      this.validateGrammar(input),
      this.validateCoverage(input),
      this.validateQuality(input),
    ];
    const failed = checks.filter((check) => !check.passed);
    return {
      status: failed.length === 0 ? 'valid' : 'rejected',
      reasons: failed.map((check) => `${check.gate}:${check.reason || 'failed'}`),
      checks,
    };
  }

  private validateStructural({ question, rubric, refs, slot }: ValidationInput): ValidationCheckResult {
    if (!question.trim()) return { gate: 'structural', passed: false, reason: 'missing_question' };
    if (!refs.length) return { gate: 'structural', passed: false, reason: 'missing_bound_entities' };
    if (!rubric.length) return { gate: 'structural', passed: false, reason: 'missing_rubric' };
    const rubricMarks = rubric.reduce((sum, component) => sum + component.marks, 0);
    if (rubricMarks !== slot.markValue) return { gate: 'structural', passed: false, reason: 'rubric_marks_mismatch' };
    if (rubric.some((component) => !component.label || !component.criteria || component.marks <= 0)) return { gate: 'structural', passed: false, reason: 'invalid_rubric_component' };
    return { gate: 'structural', passed: true };
  }

  private validateGrounding({ refs, sources }: ValidationInput): ValidationCheckResult {
    if (!refs.length) return { gate: 'grounding', passed: false, reason: 'no_bound_refs' };
    if (!sources.length) return { gate: 'grounding', passed: false, reason: 'no_sources' };
    const sourceEntityIds = new Set(sources.map((source) => source.entityId).filter(Boolean));
    const sourceDocumentIds = new Set(sources.map((source) => source.documentId).filter(Boolean));
    if (!sourceDocumentIds.size) return { gate: 'grounding', passed: false, reason: 'missing_document_source' };
    if (!refs.some((ref) => sourceEntityIds.has(ref.entityId))) return { gate: 'grounding', passed: false, reason: 'refs_not_source_backed' };
    return { gate: 'grounding', passed: true };
  }

  private validateDuplicate({ question, existingQuestions, acceptedDrafts }: ValidationInput): ValidationCheckResult {
    const normalized = this.normalizeQuestion(question);
    const candidates = [...existingQuestions.map((entry) => entry.question), ...acceptedDrafts.map((draft) => draft.question)];
    for (const candidate of candidates) {
      const other = this.normalizeQuestion(candidate);
      if (other === normalized) return { gate: 'duplicate', passed: false, reason: 'exact_duplicate' };
      if (this.jaccard(normalized, other) >= 0.92) return { gate: 'duplicate', passed: false, reason: 'semantic_duplicate' };
    }
    return { gate: 'duplicate', passed: true };
  }

  private validateDifficulty({ difficulty, slot }: ValidationInput): ValidationCheckResult {
    const expected = this.difficulty(slot.questionType, slot.markValue);
    if (difficulty !== expected) return { gate: 'difficulty', passed: false, reason: `expected_${expected}` };
    if (slot.markValue >= 15 && difficulty !== 'hard') return { gate: 'difficulty', passed: false, reason: 'high_marks_must_be_hard' };
    if (slot.questionType === 'short' && slot.markValue === 5 && difficulty !== 'easy') return { gate: 'difficulty', passed: false, reason: 'short_5_must_be_easy' };
    return { gate: 'difficulty', passed: true };
  }

  private validateGrammar({ question }: ValidationInput): ValidationCheckResult {
    if (/undefined|null|\[object Object\]/i.test(question)) return { gate: 'grammar', passed: false, reason: 'placeholder_text' };
    if (/\s{2,}/.test(question)) return { gate: 'grammar', passed: false, reason: 'excess_whitespace' };
    if (!/^[A-Z]/.test(question)) return { gate: 'grammar', passed: false, reason: 'must_start_uppercase' };
    if (!/[?.]$/.test(question)) return { gate: 'grammar', passed: false, reason: 'missing_terminal_punctuation' };
    if (!question.includes('?') && /^(what|how|why|when|where|which|who|discuss|explain|briefly|state|write|analyse|analyze|compare|distinguish|evaluate|critically|apply)/i.test(question) === false) {
      return { gate: 'grammar', passed: false, reason: 'not_question_like' };
    }
    if (question.split(/\s+/).length < 7) return { gate: 'grammar', passed: false, reason: 'too_short' };
    return { gate: 'grammar', passed: true };
  }

  private validateCoverage({ question, slot, tku }: ValidationInput): ValidationCheckResult {
    if ((slot.eligibilityScore || 0) < 0.35) return { gate: 'coverage', passed: false, reason: 'slot_eligibility_too_low' };
    if ((tku.coverageScore || 0) < 0.2) return { gate: 'coverage', passed: false, reason: 'tku_coverage_too_low' };
    const subtopicHead = slot.subtopic.toLowerCase().split(/\s+/)[0];
    if (subtopicHead && !question.toLowerCase().includes(subtopicHead)) return { gate: 'coverage', passed: false, reason: 'question_missing_subtopic' };
    return { gate: 'coverage', passed: true };
  }

  private validateQuality({ qualityScore }: ValidationInput): ValidationCheckResult {
    if (qualityScore < 0.55) return { gate: 'quality', passed: false, reason: 'quality_below_threshold' };
    return { gate: 'quality', passed: true };
  }

  private qualityScore(tku: TopicKnowledgeUnitEntity, refs: BoundEntityReference[], sources: SourceReference[]): number {
    const grounding = Math.min(1, sources.length / 3);
    const binding = Math.min(1, refs.length / 3);
    return this.round((tku.coverageScore || 0) * 0.35 + (tku.confidenceScore || 0) * 0.3 + grounding * 0.2 + binding * 0.15);
  }

  private difficulty(questionType: PlannedQuestionType, markValue: QuestionMarkValue): QuestionDifficulty {
    if (markValue <= 5 && questionType === 'short') return 'easy';
    if (markValue >= 15 || ['analytical', 'critical', 'case_based', 'problem_based'].includes(questionType)) return 'hard';
    return 'medium';
  }

  private normalizeQuestion(question: string): string {
    return question.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private jaccard(left: string, right: string): number {
    const a = new Set(left.split(' ').filter((word) => word.length > 2));
    const b = new Set(right.split(' ').filter((word) => word.length > 2));
    if (!a.size || !b.size) return 0;
    const intersection = [...a].filter((word) => b.has(word)).length;
    return intersection / new Set([...a, ...b]).size;
  }

  private shortText(text?: string): string {
    return (text || '').replace(/\s+/g, ' ').trim().slice(0, 96);
  }

  private round(value: number): number {
    return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
  }
}


