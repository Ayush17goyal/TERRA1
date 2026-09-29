import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { DocumentKnowledgeRecordEntity } from '../document-engine/entities/document-knowledge-record.entity';
import { IngestedDocumentEntity } from '../document-engine/entities/ingested-document.entity';
import { QuestionPlanningQueueService } from '../question-planning/question-planning-queue.service';
import {
  CaseEntry,
  DocumentGraph,
  ExamConstruct,
  SectionNode,
  SubtopicTag,
  TopicTag,
} from '../document-engine/types/document-graph.types';
import { PersonalExamLibraryEntity } from './entities/personal-exam-library.entity';
import { TopicKnowledgeUnitEntity } from './entities/topic-knowledge-unit.entity';
import { TopicGraphEdgeEntity, TopicGraphRelation } from './entities/topic-graph-edge.entity';
import {
  CaseRecord,
  DefinitionRecord,
  ExampleRecord,
  ExceptionRecord,
  PrincipleRecord,
  ProvisionRecord,
  SourceReference,
  TopicKeyword,
} from './knowledge-engine.types';

interface RoutedSection {
  topic: string;
  subtopic: string;
  section: SectionNode;
  topicConfidence: number;
  subtopicConfidence: number;
}

@Injectable()
export class KnowledgeEngineService {
  private readonly logger = new Logger(KnowledgeEngineService.name);
  private readonly maxMergeRetries = 4;

  constructor(
    @InjectRepository(IngestedDocumentEntity)
    private readonly documents: Repository<IngestedDocumentEntity>,
    @InjectRepository(DocumentKnowledgeRecordEntity)
    private readonly knowledgeRecords: Repository<DocumentKnowledgeRecordEntity>,
    @InjectRepository(PersonalExamLibraryEntity)
    private readonly libraries: Repository<PersonalExamLibraryEntity>,
    @InjectRepository(TopicKnowledgeUnitEntity)
    private readonly tkus: Repository<TopicKnowledgeUnitEntity>,
    @InjectRepository(TopicGraphEdgeEntity)
    private readonly graphEdges: Repository<TopicGraphEdgeEntity>,
    @Optional() private readonly questionPlanningQueue?: QuestionPlanningQueueService,
  ) {}

  // architecture.md §4.2H: "Library Persistence — emit 'topic ready' signal once thresholds are
  // crossed." A TKU is considered ready for question generation once it clears the same minimum
  // coverage bar Module 4 itself enforces (question-bank.service.ts's Gate 5 rejects any TKU
  // below coverageScore 0.2), so we gate the downstream trigger on that same threshold rather
  // than firing question-planning on every incremental document add regardless of depth.
  private readonly topicReadyCoverageThreshold = 0.2;

  async buildFromDocument(documentId: string): Promise<void> {
    const document = await this.documents.findOne({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Document not found');

    const record = await this.knowledgeRecords.findOne({ where: { documentId } });
    if (!record) throw new NotFoundException('KnowledgeBaseRecord not found');

    try {
      await this.ensureLibrary(document.userId, 'building', 'extracting_topics');
      document.status = 'building_knowledge' as any;
      document.stageProgress = {
        ...(document.stageProgress || {}),
        extracting_topics: 'in_progress',
      };
      await this.documents.save(document);

      const routedSections = this.routeTopics(record.graph);
      document.stageProgress = {
        ...(document.stageProgress || {}),
        extracting_topics: 'completed',
        building_topic_graph: 'in_progress',
      };
      await this.documents.save(document);

      const touchedTkuIds: string[] = [];
      for (const [key, sections] of this.groupByTku(routedSections)) {
        const [topic, subtopic] = key.split('\u0000');
        const tku = await this.mergeTkuWithRetry(document.userId, topic, subtopic, sections, record, document.confidenceScore);
        touchedTkuIds.push(tku.id);
      }

      await this.updateTopicGraph(document.userId, touchedTkuIds);
      document.stageProgress = {
        ...(document.stageProgress || {}),
        building_topic_graph: 'completed',
        calculating_coverage: 'in_progress',
      };
      await this.documents.save(document);

      await this.refreshLibraryStats(document.userId);
      document.stageProgress = {
        ...(document.stageProgress || {}),
        calculating_coverage: 'completed',
        knowledge_library_ready: 'completed',
      };
      document.status = 'knowledge_ready' as any;
      await this.documents.save(document);

      await this.emitTopicReadyIfThresholdCrossed(document.userId, touchedTkuIds);
    } catch (error: any) {
      this.logger.error(`Knowledge Engine failed for document ${documentId}: ${error.message}`, error.stack);
      await this.ensureLibrary(document.userId, 'failed', null, [error.message]);
      document.status = 'failed';
      document.errorMessage = error.message;
      await this.documents.save(document);
      throw error;
    }
  }

  // architecture.md §4.2H "topic ready" signal -> §7's Question Generation Engine trigger.
  // Replicates the exact enqueue mechanism document-engine-pipeline.service.ts uses to hand off
  // to this module (KnowledgeEngineQueueService.enqueue), just one queue further down the chain:
  // document-engine -> knowledge-engine -> question-planning -> question-bank -> model-answer.
  private async emitTopicReadyIfThresholdCrossed(userId: string, touchedTkuIds: string[]): Promise<void> {
    if (!this.questionPlanningQueue || touchedTkuIds.length === 0) return;
    const touched = await this.tkus.findBy({ id: In(touchedTkuIds) });
    const crossedThreshold = touched.some((tku) => (tku.coverageScore || 0) >= this.topicReadyCoverageThreshold);
    if (crossedThreshold) {
      this.questionPlanningQueue.enqueue(userId);
    }
  }

  async getLibrary(userId: string): Promise<PersonalExamLibraryEntity> {
    return this.ensureLibrary(userId, 'ready', 'knowledge_library_ready');
  }

  async listTopics(userId: string): Promise<TopicKnowledgeUnitEntity[]> {
    return this.tkus.find({ where: { userId }, order: { topic: 'ASC', subtopic: 'ASC' } });
  }

  async getTopic(userId: string, tkuId: string): Promise<TopicKnowledgeUnitEntity> {
    const tku = await this.tkus.findOne({ where: { id: tkuId, userId } });
    if (!tku) throw new NotFoundException('Topic knowledge unit not found');
    return tku;
  }

  async getTopicGraph(userId: string): Promise<{ nodes: TopicKnowledgeUnitEntity[]; edges: TopicGraphEdgeEntity[] }> {
    const [nodes, edges] = await Promise.all([
      this.tkus.find({ where: { userId }, order: { topic: 'ASC', subtopic: 'ASC' } }),
      this.graphEdges.find({ where: { userId } }),
    ]);
    return { nodes, edges };
  }

  private routeTopics(graph: DocumentGraph): RoutedSection[] {
    return graph.sections.map((section) => {
      const topicTags = graph.topicTags[section.id] || [];
      const subtopicTags = graph.subtopicTags[section.id] || [];
      const bestTopic = this.bestTopic(section, topicTags);
      const bestSubtopic = this.bestSubtopic(section, bestTopic.topic, subtopicTags);
      return {
        topic: bestTopic.topic,
        subtopic: bestSubtopic.subtopic,
        section,
        topicConfidence: bestTopic.confidence,
        subtopicConfidence: bestSubtopic.confidence,
      };
    });
  }

  private bestTopic(section: SectionNode, tags: TopicTag[]): TopicTag {
    if (tags.length > 0) return tags[0];
    const heading = section.hierarchyPath.split('>').map((p) => p.trim()).filter(Boolean)[0];
    return { topic: heading || 'Uncategorized', confidence: heading ? 0.35 : 0.2 };
  }

  private bestSubtopic(section: SectionNode, topic: string, tags: SubtopicTag[]): SubtopicTag {
    const matching = tags.find((tag) => tag.topic === topic) || tags[0];
    if (matching) return matching;
    const parts = section.hierarchyPath.split('>').map((p) => p.trim()).filter(Boolean);
    return { topic, subtopic: parts[1] || parts[0] || 'General', confidence: parts.length ? 0.35 : 0.2 };
  }

  private groupByTku(sections: RoutedSection[]): Map<string, RoutedSection[]> {
    const grouped = new Map<string, RoutedSection[]>();
    for (const section of sections) {
      const key = `${section.topic}\u0000${section.subtopic}`;
      grouped.set(key, [...(grouped.get(key) || []), section]);
    }
    return grouped;
  }

  private async mergeTkuWithRetry(
    userId: string,
    topic: string,
    subtopic: string,
    sections: RoutedSection[],
    record: DocumentKnowledgeRecordEntity,
  documentConfidence: number,
  ): Promise<TopicKnowledgeUnitEntity> {
    for (let attempt = 0; attempt < this.maxMergeRetries; attempt++) {
      let current = await this.tkus.findOne({ where: { userId, topic, subtopic } });
      if (!current) {
        current = await this.createEmptyTku(userId, topic, subtopic);
      }

      const originalVersion = current.version;
      const merged = this.mergeIntoTku(current, sections, record, documentConfidence);
      const result = await this.tkus
        .createQueryBuilder()
        .update(TopicKnowledgeUnitEntity)
        .set({
          summary: merged.summary,
          definitions: merged.definitions,
          legalProvisions: merged.legalProvisions,
          principles: merged.principles,
          exceptions: merged.exceptions,
          landmarkCases: merged.landmarkCases,
          referencedCases: merged.referencedCases,
          illustrations: merged.illustrations,
          examples: merged.examples,
          comparisons: merged.comparisons,
          keywords: merged.keywords,
          references: merged.references,
          coverageScore: merged.coverageScore,
          confidenceScore: merged.confidenceScore,
        })
        .where('id = :id', { id: current.id })
        .andWhere('version = :version', { version: originalVersion })
        .execute();

      if ((result.affected || 0) > 0) {
        return this.tkus.findOneByOrFail({ id: current.id });
      }
    }
    throw new Error(`Optimistic concurrency conflict while merging ${topic} / ${subtopic}`);
  }

  private async createEmptyTku(userId: string, topic: string, subtopic: string): Promise<TopicKnowledgeUnitEntity> {
    try {
      return await this.tkus.save(
        this.tkus.create({
          userId,
          topic,
          subtopic,
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
          coverageScore: 0,
          confidenceScore: 0,
        }),
      );
    } catch {
      return this.tkus.findOneByOrFail({ userId, topic, subtopic });
    }
  }

  private mergeIntoTku(
    current: TopicKnowledgeUnitEntity,
    routedSections: RoutedSection[],
    record: DocumentKnowledgeRecordEntity,
  documentConfidence: number,
  ): TopicKnowledgeUnitEntity {
    const sectionIds = new Set(routedSections.map((r) => r.section.id));
    const graph = record.graph;
    const references = this.mergeReferences(
      current.references || [],
      routedSections.map((r) => this.sourceRef(record.documentId, r.section.id, r.section.id, r.section.hierarchyPath, r.section.text)),
    );

    const definitions = this.mergeDefinitions(current.definitions || [], graph, sectionIds, record.documentId);
    const legalProvisions = this.mergeProvisions(current.legalProvisions || [], routedSections, record.documentId);
    const principles = this.mergePrinciples(current.principles || [], graph.examConstructs, sectionIds, record.documentId, graph);
    const exceptions = this.mergeExceptions(current.exceptions || [], graph.examConstructs, sectionIds, record.documentId, graph, principles);
    const cases = this.mergeCases(
      [...(current.landmarkCases || []), ...(current.referencedCases || [])],
      graph.cases.filter((c) => c.sectionId && sectionIds.has(c.sectionId)),
      record.documentId,
      graph,
    );
    const illustrations = this.mergeExamples(
      current.illustrations || [],
      graph.illustrations.filter((i) => sectionIds.has(i.sectionId)),
      record.documentId,
      graph,
      'illustration',
    );
    const examples = this.mergeSectionExamples(current.examples || [], routedSections, record.documentId);
    const comparisons = this.mergeComparisons(current.comparisons || [], definitions, principles, references);
    const keywords = this.computeKeywords(current.topic, current.subtopic, definitions, legalProvisions, principles, exceptions, cases, examples);

    current.definitions = definitions;
    current.legalProvisions = legalProvisions;
    current.principles = principles;
    current.exceptions = exceptions;
    current.landmarkCases = cases.filter((c) => c.isLandmark);
    current.referencedCases = cases.filter((c) => !c.isLandmark);
    current.illustrations = illustrations;
    current.examples = examples;
    current.comparisons = comparisons;
    current.keywords = keywords;
    current.references = references;
    current.summary = this.summarize(current);
    current.coverageScore = this.calculateCoverage(current);
    current.confidenceScore = this.calculateConfidence(routedSections, documentConfidence, current);
    return current;
  }

  private mergeDefinitions(existing: DefinitionRecord[], graph: DocumentGraph, sectionIds: Set<string>, documentId: string): DefinitionRecord[] {
    const byKey = new Map(existing.map((d) => [this.normalize(d.term), d]));
    for (const definition of graph.definitions.filter((d) => sectionIds.has(d.sectionId))) {
      const section = graph.sections.find((s) => s.id === definition.sectionId);
      const key = this.normalize(definition.term);
      const prior = byKey.get(key);
      const sourceRef = this.sourceRef(documentId, definition.sectionId, definition.id, section?.hierarchyPath, definition.definitionText);
      if (!prior) {
        byKey.set(key, {
          id: this.stableId('definition', key),
          term: definition.term.trim(),
          definitionText: definition.definitionText.trim(),
          definitionType: definition.definitionType,
          sourceRefs: [sourceRef],
        });
      } else {
        prior.definitionText = this.preferLonger(prior.definitionText, definition.definitionText);
        prior.sourceRefs = this.mergeReferences(prior.sourceRefs, [sourceRef]);
      }
    }
    return [...byKey.values()].sort((a, b) => a.term.localeCompare(b.term));
  }

  private mergeProvisions(existing: ProvisionRecord[], routedSections: RoutedSection[], documentId: string): ProvisionRecord[] {
    const byKey = new Map(existing.map((p) => [p.normalizedKey, p]));
    for (const { section } of routedSections.filter((r) => r.section.sectionType === 'statutory_provision')) {
      const key = this.normalize(section.hierarchyPath || section.text.slice(0, 80));
      const sourceRef = this.sourceRef(documentId, section.id, section.id, section.hierarchyPath, section.text);
      if (!byKey.has(key)) {
        byKey.set(key, {
          id: this.stableId('provision', key),
          text: section.text.trim(),
          normalizedKey: key,
          sourceRefs: [sourceRef],
        });
      } else {
        const prior = byKey.get(key)!;
        prior.text = this.preferLonger(prior.text, section.text);
        prior.sourceRefs = this.mergeReferences(prior.sourceRefs, [sourceRef]);
      }
    }
    return [...byKey.values()];
  }

  private mergePrinciples(
    existing: PrincipleRecord[],
    constructs: ExamConstruct[],
    sectionIds: Set<string>,
    documentId: string,
    graph: DocumentGraph,
  ): PrincipleRecord[] {
    const byKey = new Map(existing.map((p) => [this.normalize(p.text), p]));
    for (const construct of constructs.filter((c) => sectionIds.has(c.sectionId) && c.constructType !== 'exception')) {
      const key = this.normalize(construct.text);
      const section = graph.sections.find((s) => s.id === construct.sectionId);
      const sourceRef = this.sourceRef(documentId, construct.sectionId, construct.sectionId, section?.hierarchyPath, construct.text);
      if (!byKey.has(key)) {
        byKey.set(key, {
          id: this.stableId('principle', key),
          text: construct.text.trim(),
          constructType: construct.constructType as any,
          sourceRefs: [sourceRef],
        });
      } else {
        byKey.get(key)!.sourceRefs = this.mergeReferences(byKey.get(key)!.sourceRefs, [sourceRef]);
      }
    }
    return [...byKey.values()];
  }

  private mergeExceptions(
    existing: ExceptionRecord[],
    constructs: ExamConstruct[],
    sectionIds: Set<string>,
    documentId: string,
    graph: DocumentGraph,
    principles: PrincipleRecord[],
  ): ExceptionRecord[] {
    const byKey = new Map(existing.map((e) => [this.normalize(e.text), e]));
    for (const construct of constructs.filter((c) => sectionIds.has(c.sectionId) && c.constructType === 'exception')) {
      const key = this.normalize(construct.text);
      const section = graph.sections.find((s) => s.id === construct.sectionId);
      const sourceRef = this.sourceRef(documentId, construct.sectionId, construct.sectionId, section?.hierarchyPath, construct.text);
      const qualifiesPrincipleId = this.closestPrincipleId(construct.text, principles);
      if (!byKey.has(key)) {
        byKey.set(key, { id: this.stableId('exception', key), text: construct.text.trim(), qualifiesPrincipleId, sourceRefs: [sourceRef] });
      } else {
        const prior = byKey.get(key)!;
        prior.qualifiesPrincipleId = prior.qualifiesPrincipleId || qualifiesPrincipleId;
        prior.sourceRefs = this.mergeReferences(prior.sourceRefs, [sourceRef]);
      }
    }
    return [...byKey.values()];
  }

  private mergeCases(existing: CaseRecord[], incoming: CaseEntry[], documentId: string, graph: DocumentGraph): CaseRecord[] {
    const byKey = new Map(existing.map((c) => [this.normalizeCase(c.caseName, c.year), c]));
    for (const c of incoming) {
      const key = this.normalizeCase(c.caseName, c.year);
      const section = graph.sections.find((s) => s.id === c.sectionId);
      const sourceRef = this.sourceRef(documentId, c.sectionId, c.id, section?.hierarchyPath, c.context);
      const isLandmark = c.mentionType === 'full' || Boolean(c.structured?.held || c.structured?.ratio);
      if (!byKey.has(key)) {
        byKey.set(key, {
          id: this.stableId('case', key),
          caseName: c.caseName,
          court: c.court,
          year: c.year,
          structured: c.structured,
          isLandmark,
          isReferenced: !isLandmark,
          sourceRefs: [sourceRef],
        });
      } else {
        const prior = byKey.get(key)!;
        prior.court = prior.court || c.court;
        prior.year = prior.year || c.year;
        prior.structured = this.mergeStructuredCase(prior.structured, c.structured);
        prior.isLandmark = prior.isLandmark || isLandmark;
        prior.isReferenced = !prior.isLandmark;
        prior.sourceRefs = this.mergeReferences(prior.sourceRefs, [sourceRef]);
      }
    }
    return [...byKey.values()].sort((a, b) => a.caseName.localeCompare(b.caseName));
  }

  private mergeExamples(
    existing: ExampleRecord[],
    incoming: Array<{ id: string; sectionId: string; text: string; illustrationType: any; linkedDefinitionId?: string | null; linkedConstructSectionId?: string | null }>,
    documentId: string,
    graph: DocumentGraph,
    kind: 'illustration',
  ): ExampleRecord[] {
    const byKey = new Map(existing.map((e) => [this.normalize(e.text), e]));
    for (const example of incoming) {
      const key = this.normalize(example.text);
      const section = graph.sections.find((s) => s.id === example.sectionId);
      const sourceRef = this.sourceRef(documentId, example.sectionId, example.id, section?.hierarchyPath, example.text);
      if (!byKey.has(key)) {
        byKey.set(key, {
          id: this.stableId(kind, key),
          text: example.text.trim(),
          exampleType: example.illustrationType,
          illustratesEntityId: example.linkedDefinitionId || example.linkedConstructSectionId || null,
          sourceRefs: [sourceRef],
        });
      } else {
        byKey.get(key)!.sourceRefs = this.mergeReferences(byKey.get(key)!.sourceRefs, [sourceRef]);
      }
    }
    return [...byKey.values()];
  }

  private mergeSectionExamples(existing: ExampleRecord[], routedSections: RoutedSection[], documentId: string): ExampleRecord[] {
    const byKey = new Map(existing.map((e) => [this.normalize(e.text), e]));
    const regex = /\b(for example|for instance|illustration|e\.g\.)\b[:\s-]*(.{30,240})/gi;
    for (const { section } of routedSections) {
      for (const match of section.text.matchAll(regex)) {
        const text = `${match[1]} ${match[2]}`.trim();
        const key = this.normalize(text);
        const sourceRef = this.sourceRef(documentId, section.id, section.id, section.hierarchyPath, text);
        if (!byKey.has(key)) {
          byKey.set(key, {
            id: this.stableId('example', key),
            text,
            exampleType: 'section_example',
            illustratesEntityId: null,
            sourceRefs: [sourceRef],
          });
        } else {
          byKey.get(key)!.sourceRefs = this.mergeReferences(byKey.get(key)!.sourceRefs, [sourceRef]);
        }
      }
    }
    return [...byKey.values()];
  }

  private mergeComparisons(
    existing: any[],
    definitions: DefinitionRecord[],
    principles: PrincipleRecord[],
    references: SourceReference[],
  ): any[] {
    const comparisons = [...existing];
    const seen = new Set(comparisons.map((c) => `${c.leftEntityId}:${c.rightEntityId}:${c.axis}`));
    const candidates = [...definitions, ...principles].slice(0, 6);
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const left = candidates[i];
        const right = candidates[j];
        const axis = this.sharedComparisonAxis(left, right);
        if (!axis) continue;
        const key = `${left.id}:${right.id}:${axis}`;
        if (!seen.has(key)) {
          seen.add(key);
          comparisons.push({ id: this.stableId('comparison', key), leftEntityId: left.id, rightEntityId: right.id, axis, sourceRefs: references.slice(0, 3) });
        }
      }
    }
    return comparisons;
  }

  private sharedComparisonAxis(left: any, right: any): string | null {
    const leftWords = new Set(this.normalize(`${left.term || ''} ${left.text || ''}`).split(' ').filter((w) => w.length > 4));
    const rightWords = this.normalize(`${right.term || ''} ${right.text || ''}`).split(' ').filter((w) => w.length > 4);
    const shared = rightWords.find((word) => leftWords.has(word));
    return shared ? `shared concept: ${shared}` : null;
  }

  private async updateTopicGraph(userId: string, touchedTkuIds: string[]): Promise<void> {
    const tkus = await this.tkus.find({ where: { userId } });
    const touched = tkus.filter((t) => touchedTkuIds.includes(t.id));
    for (const tku of touched) {
      const siblings = tkus.filter((candidate) => candidate.id !== tku.id && candidate.topic === tku.topic);
      for (const sibling of siblings) {
        await this.upsertEdge(userId, tku, sibling, 'parent_child', 0.8);
      }

      const tkuCases = new Set([...tku.landmarkCases, ...tku.referencedCases].map((c) => this.normalizeCase(c.caseName, c.year)));
      const tkuKeywords = new Set(tku.keywords.map((k) => this.normalize(k.value)));
      for (const other of tkus.filter((candidate) => candidate.id !== tku.id && candidate.topic !== tku.topic)) {
        const sharedCases = [...other.landmarkCases, ...other.referencedCases].some((c) => tkuCases.has(this.normalizeCase(c.caseName, c.year)));
        const sharedKeywords = other.keywords.some((k) => tkuKeywords.has(this.normalize(k.value)));
        if (sharedCases) await this.upsertEdge(userId, tku, other, 'case_links', 0.7);
        else if (sharedKeywords) await this.upsertEdge(userId, tku, other, 'related', 0.45);
      }
    }
  }

  private async upsertEdge(
    userId: string,
    source: TopicKnowledgeUnitEntity,
    target: TopicKnowledgeUnitEntity,
    relation: TopicGraphRelation,
    strength: number,
  ): Promise<void> {
    const [sourceTkuId, targetTkuId] = [source.id, target.id].sort();
    let edge = await this.graphEdges.findOne({ where: { userId, sourceTkuId, targetTkuId, relation } });
    if (!edge) edge = this.graphEdges.create({ userId, sourceTkuId, targetTkuId, relation, strength, references: [] });
    edge.strength = Math.max(edge.strength, strength);
    edge.references = this.mergeReferences(edge.references || [], [...source.references.slice(0, 2), ...target.references.slice(0, 2)]);
    await this.graphEdges.save(edge);
  }

  private async ensureLibrary(
    userId: string,
    status: PersonalExamLibraryEntity['status'],
    currentStage: PersonalExamLibraryEntity['currentStage'],
    reviewReasons: string[] = [],
  ): Promise<PersonalExamLibraryEntity> {
    let library = await this.libraries.findOne({ where: { userId } });
    if (!library) library = this.libraries.create({ userId });
    library.status = status;
    library.currentStage = currentStage;
    library.reviewReasons = reviewReasons;
    return this.libraries.save(library);
  }

  private async refreshLibraryStats(userId: string): Promise<void> {
    const tkus = await this.tkus.find({ where: { userId } });
    const library = await this.ensureLibrary(userId, 'ready', 'knowledge_library_ready');
    library.topicsCount = new Set(tkus.map((t) => t.topic)).size;
    library.subtopicsCount = tkus.length;
    library.definitionsCount = tkus.reduce((sum, t) => sum + (t.definitions?.length || 0), 0);
    library.casesCount = tkus.reduce((sum, t) => sum + (t.landmarkCases?.length || 0) + (t.referencedCases?.length || 0), 0);
    library.illustrationsCount = tkus.reduce((sum, t) => sum + (t.illustrations?.length || 0) + (t.examples?.length || 0), 0);
    library.coverageScore = this.average(tkus.map((t) => t.coverageScore));
    library.confidenceScore = this.average(tkus.map((t) => t.confidenceScore));
    library.status = tkus.some((t) => t.confidenceScore < 0.45) ? 'needs_review' : 'ready';
    library.currentStage = 'knowledge_library_ready';
    await this.libraries.save(library);
  }

  private summarize(tku: TopicKnowledgeUnitEntity): string {
    const parts = [
      `${tku.topic} / ${tku.subtopic}`,
      tku.definitions.length ? `${tku.definitions.length} definition(s)` : '',
      tku.legalProvisions.length ? `${tku.legalProvisions.length} provision(s)` : '',
      tku.principles.length ? `${tku.principles.length} principle(s)` : '',
      tku.exceptions.length ? `${tku.exceptions.length} exception(s)` : '',
      tku.landmarkCases.length ? `${tku.landmarkCases.length} landmark case(s)` : '',
      tku.illustrations.length + tku.examples.length ? `${tku.illustrations.length + tku.examples.length} illustration/example(s)` : '',
    ].filter(Boolean);
    const lead = parts.join(' with ');
    const firstPrinciple = tku.principles[0]?.text || tku.legalProvisions[0]?.text || tku.definitions[0]?.definitionText || '';
    return [lead, firstPrinciple.slice(0, 280)].filter(Boolean).join('. ');
  }

  private calculateCoverage(tku: TopicKnowledgeUnitEntity): number {
    const weights = [
      Math.min(1, tku.definitions.length / 2) * 0.16,
      Math.min(1, tku.legalProvisions.length / 2) * 0.18,
      Math.min(1, tku.principles.length / 2) * 0.16,
      Math.min(1, tku.exceptions.length / 1) * 0.12,
      Math.min(1, (tku.landmarkCases.length + tku.referencedCases.length) / 2) * 0.18,
      Math.min(1, (tku.illustrations.length + tku.examples.length) / 2) * 0.12,
      Math.min(1, tku.references.length / 3) * 0.08,
    ];
    return this.round(weights.reduce((a, b) => a + b, 0));
  }

  private calculateConfidence(
    routedSections: RoutedSection[],
    documentConfidence: number,
    tku: TopicKnowledgeUnitEntity,
  ): number {
    const routeConfidence = this.average(routedSections.map((r) => (r.topicConfidence + r.subtopicConfidence + r.section.confidence) / 3));
    const sourceDiversity = Math.min(1, new Set(tku.references.map((r) => r.documentId)).size / 2);
    const entitySupport = Math.min(1, tku.references.length / Math.max(1, tku.definitions.length + tku.legalProvisions.length + tku.principles.length));
    return this.round(documentConfidence * 0.35 + routeConfidence * 0.4 + sourceDiversity * 0.1 + entitySupport * 0.15);
  }

  private computeKeywords(
    topic: string,
    subtopic: string,
    definitions: DefinitionRecord[],
    provisions: ProvisionRecord[],
    principles: PrincipleRecord[],
    exceptions: ExceptionRecord[],
    cases: CaseRecord[],
    examples: ExampleRecord[],
  ): TopicKeyword[] {
    const text = [
      topic,
      subtopic,
      ...definitions.map((d) => `${d.term} ${d.definitionText}`),
      ...provisions.map((p) => p.text),
      ...principles.map((p) => p.text),
      ...exceptions.map((e) => e.text),
      ...cases.map((c) => c.caseName),
      ...examples.map((e) => e.text),
    ].join(' ');
    const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'shall', 'under', 'from', 'into', 'where', 'which', 'case', 'section']);
    const counts = new Map<string, number>();
    for (const word of text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []) {
      if (!stop.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([value, count]) => ({ value, weight: this.round(count / Math.max(1, counts.size)) }));
  }

  private closestPrincipleId(text: string, principles: PrincipleRecord[]): string | null {
    const words = new Set(this.normalize(text).split(' ').filter((w) => w.length > 4));
    let best: { id: string; score: number } | null = null;
    for (const principle of principles) {
      const score = this.normalize(principle.text).split(' ').filter((w) => words.has(w)).length;
      if (!best || score > best.score) best = { id: principle.id, score };
    }
    return best && best.score > 0 ? best.id : principles[0]?.id || null;
  }

  private mergeStructuredCase(existing: CaseRecord['structured'], incoming: CaseEntry['structured']): CaseRecord['structured'] {
    if (!existing) return incoming;
    if (!incoming) return existing;
    return {
      facts: this.preferLonger(existing.facts || '', incoming.facts || '') || undefined,
      issues: this.preferLonger(existing.issues || '', incoming.issues || '') || undefined,
      held: this.preferLonger(existing.held || '', incoming.held || '') || undefined,
      ratio: this.preferLonger(existing.ratio || '', incoming.ratio || '') || undefined,
    };
  }

  private mergeReferences(existing: SourceReference[], incoming: SourceReference[]): SourceReference[] {
    const byKey = new Map<string, SourceReference>();
    for (const ref of [...existing, ...incoming]) {
      const key = `${ref.documentId}:${ref.sectionId || ''}:${ref.entityId || ''}:${ref.sourceType}`;
      byKey.set(key, ref);
    }
    return [...byKey.values()];
  }

  private sourceRef(documentId: string, sectionId?: string | null, entityId?: string | null, hierarchyPath?: string, text?: string): SourceReference {
    return { documentId, sectionId, entityId, sourceType: 'document', hierarchyPath, text: text?.slice(0, 500) };
  }

  private stableId(prefix: string, key: string): string {
    return `${prefix}_${crypto.createHash('sha1').update(key).digest('hex').slice(0, 16)}`;
  }

  private normalize(value: string): string {
    return (value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private normalizeCase(name: string, year?: string | null): string {
    return `${this.normalize(name.replace(/\b(vs?\.?|versus)\b/gi, ' v '))}:${year || ''}`;
  }

  private preferLonger(a: string, b: string): string {
    return (b || '').trim().length > (a || '').trim().length ? b.trim() : (a || '').trim();
  }

  private average(values: number[]): number {
    const finite = values.filter((v) => Number.isFinite(v));
    return finite.length ? this.round(finite.reduce((a, b) => a + b, 0) / finite.length) : 0;
  }

  private round(value: number): number {
    return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
  }
}






