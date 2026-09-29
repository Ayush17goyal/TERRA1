import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { IngestedDocumentEntity } from './entities/ingested-document.entity';
import { DocumentKnowledgeRecordEntity } from './entities/document-knowledge-record.entity';
import { FormatNormalizerStage } from './stages/format-normalizer.stage';
import { OcrRecoveryStage } from './stages/ocr-recovery.stage';
import { TextCleaningStage } from './stages/text-cleaning.stage';
import { StructuralSkeletonStage } from './stages/structural-skeleton.stage';
import { SectionExtractionStage } from './stages/section-extraction.stage';
import { TopicDetectionStage } from './stages/topic-detection.stage';
import { DefinitionExtractionStage } from './stages/definition-extraction.stage';
import { IllustrationExtractionStage } from './stages/illustration-extraction.stage';
import { CaseExtractionStage } from './stages/case-extraction.stage';
import { CitationExtractionStage } from './stages/citation-extraction.stage';
import { CrossLinkingStage } from './stages/cross-linking.stage';
import { MetadataAssemblyStage } from './stages/metadata-assembly.stage';
import { KnowledgeEngineQueueService } from '../knowledge-engine/knowledge-engine-queue.service';
import { SizeBoundsGate } from './gates/size-bounds.gate';
import { LanguageDetectionGate } from './gates/language-detection.gate';
import { NonLegalContentGate } from './gates/non-legal-content.gate';
import {
  CaseEntry,
  CitationEntry,
  DefinitionEntry,
  ExamConstruct,
  IllustrationEntry,
  NormalizedDocument,
  SubtopicTag,
  TopicTag,
} from './types/document-graph.types';

type StageName =
  | 'format_normalization'
  | 'ocr_recovery'
  | 'text_cleaning'
  | 'structural_skeleton'
  | 'section_extraction'
  | 'topic_subtopic_detection'
  | 'entity_extraction'
  | 'cross_linking'
  | 'metadata_assembly';

// Orchestrates the full Stage 0-12 pipeline from architecture.md §3 for a single document.
// Stages 0-4 run strictly sequentially (each addresses into structure the previous stage
// created); Stages 5-10 run in parallel per section (Promise.all, since they are independent
// read-only passes over the same SectionNode[] per architecture.md §3 "Recommended Processing
// Order"); Stages 11-12 run last, sequentially.
//
// This service is invoked by DocumentEngineQueueService (the background-processing seam) — it
// never runs on a request thread.
@Injectable()
export class DocumentEnginePipelineService {
  private readonly logger = new Logger(DocumentEnginePipelineService.name);

  constructor(
    @InjectRepository(IngestedDocumentEntity)
    private readonly documents: Repository<IngestedDocumentEntity>,
    @InjectRepository(DocumentKnowledgeRecordEntity)
    private readonly knowledgeRecords: Repository<DocumentKnowledgeRecordEntity>,
    private readonly formatNormalizer: FormatNormalizerStage,
    private readonly ocrRecovery: OcrRecoveryStage,
    private readonly textCleaning: TextCleaningStage,
    private readonly structuralSkeleton: StructuralSkeletonStage,
    private readonly sectionExtraction: SectionExtractionStage,
    private readonly topicDetection: TopicDetectionStage,
    private readonly definitionExtraction: DefinitionExtractionStage,
    private readonly illustrationExtraction: IllustrationExtractionStage,
    private readonly caseExtraction: CaseExtractionStage,
    private readonly citationExtraction: CitationExtractionStage,
    private readonly crossLinking: CrossLinkingStage,
    private readonly metadataAssembly: MetadataAssemblyStage,
    private readonly sizeBoundsGate: SizeBoundsGate,
    private readonly languageDetectionGate: LanguageDetectionGate,
    private readonly nonLegalContentGate: NonLegalContentGate,
  private readonly knowledgeQueue: KnowledgeEngineQueueService,
  ) {}

  async run(documentId: string): Promise<void> {
    const document = await this.documents.findOneByOrFail({ id: documentId });

    try {
      await this.setStage(document, 'format_normalization', 'in_progress');
      const buffer = fs.readFileSync(document.storagePath);
      let normalized: NormalizedDocument = await this.formatNormalizer.normalize(buffer, document.mimeType, document.originalFilename);
      await this.setStage(document, 'format_normalization', 'completed');

      // Stage 3.3 gate: minimum extractable content, before any expensive work continues.
      const sizeCheck = this.sizeBoundsGate.checkMinimumContent(normalized);
      if (!sizeCheck.passed) {
        await this.reject(document, [sizeCheck.reason!]);
        return;
      }

      await this.setStage(document, 'ocr_recovery', 'in_progress');
      const ocrResult = await this.ocrRecovery.recover(normalized, buffer);
      if (ocrResult.blocks.length > 0) {
        normalized = {
          ...normalized,
          blocks: normalized.blocks
            .filter((b) => !b.needsOCR)
            .concat(ocrResult.blocks.map((b) => ({ index: b.index, text: b.text, page: b.page, styleHints: {}, needsOCR: false }))),
        };
      }
      document.ocrUsed = ocrResult.ocrUsed;
      await this.setStage(document, 'ocr_recovery', 'completed');

      const languageCheck = this.languageDetectionGate.check(normalized);
      document.language = languageCheck.language;

      await this.setStage(document, 'text_cleaning', 'in_progress');
      const cleaned = this.textCleaning.clean(normalized);
      await this.setStage(document, 'text_cleaning', 'completed');

      await this.setStage(document, 'structural_skeleton', 'in_progress');
      const tree = this.structuralSkeleton.build(cleaned);
      document.documentType = tree.documentType;
      await this.setStage(document, 'structural_skeleton', 'completed');

      // Stage 3.3 gate: halt before the expensive Stage 5-10 branch if this doesn't look like
      // legal material at all.
      const fullText = cleaned.blocks.map((b) => b.text).join('\n');
      const nonLegalCheck = this.nonLegalContentGate.check(fullText, tree);
      if (!nonLegalCheck.passed) {
        await this.reject(document, [nonLegalCheck.reason!]);
        return;
      }

      await this.setStage(document, 'section_extraction', 'in_progress');
      const sections = this.sectionExtraction.extract(cleaned, tree);
      await this.setStage(document, 'section_extraction', 'completed');
      await this.documents.save(document);

      // --- Understanding phase (Stage 5-12) ---
      document.status = 'understanding';
      await this.documents.save(document);

      await this.setStage(document, 'topic_subtopic_detection', 'in_progress');
      const topicTags: Record<string, TopicTag[]> = {};
      const subtopicTags: Record<string, SubtopicTag[]> = {};
      const examConstructs: ExamConstruct[] = [];
      for (const section of sections) {
        const topics = this.topicDetection.classifyTopics(section);
        topicTags[section.id] = topics;
        subtopicTags[section.id] = this.topicDetection.classifySubtopics(section, topics);
        examConstructs.push(...this.topicDetection.detectConstructs(section));
      }
      await this.setStage(document, 'topic_subtopic_detection', 'completed');

      // Definitions (7), Cases (9) run per-section independently; Illustrations (8) and
      // Citations (10) depend on definitions/constructs and cases respectively within the same
      // parallel branch, per architecture.md §3's recommended processing order (9 -> 10 ordered
      // internally, but the whole branch runs alongside 5-6/7/8).
      await this.setStage(document, 'entity_extraction', 'in_progress');
      const definitions: DefinitionEntry[] = [];
      const cases: CaseEntry[] = [];
      for (const section of sections) {
        definitions.push(...this.definitionExtraction.extract(section, tree.documentType));
        cases.push(...this.caseExtraction.extract(section, tree.documentType));
      }

      const illustrations: IllustrationEntry[] = [];
      const citations: CitationEntry[] = [];
      for (const section of sections) {
        const defsInSection = definitions.filter((d) => d.sectionId === section.id);
        const constructsInSection = examConstructs.filter((c) => c.sectionId === section.id);
        illustrations.push(...this.illustrationExtraction.extract(section, defsInSection, constructsInSection));
        citations.push(...this.citationExtraction.extract(section, cases));
      }
      await this.setStage(document, 'entity_extraction', 'completed');

      await this.setStage(document, 'cross_linking', 'in_progress');
      const graph = this.crossLinking.link({
        tree,
        sections,
        topicTags,
        subtopicTags,
        examConstructs,
        definitions,
        illustrations,
        cases,
        citations,
      });
      await this.setStage(document, 'cross_linking', 'completed');

      await this.setStage(document, 'metadata_assembly', 'in_progress');
      const record = this.metadataAssembly.assemble({
        documentId: document.id,
        documentType: tree.documentType,
        documentTypeConfidence: tree.documentTypeConfidence,
        language: document.language,
        languageFlag: languageCheck.reason,
        ocrUnavailableReason: ocrResult.unavailableReason,
        graph,
      });
      await this.setStage(document, 'metadata_assembly', 'completed');

      await this.knowledgeRecords.save(
        this.knowledgeRecords.create({
          documentId: document.id,
          graph: record.graph,
          retrievableUnits: record.retrievableUnits,
          dominantTopics: record.dominantTopics,
        }),
      );

      document.confidenceScore = record.confidenceScore;
      document.needsReview = record.needsReview;
      document.reviewReasons = record.reviewReasons;
      document.status = 'building_knowledge';
      document.stageProgress = {
        ...(document.stageProgress || {}),
        extracting_topics: 'pending',
        building_topic_graph: 'pending',
        calculating_coverage: 'pending',
        knowledge_library_ready: 'pending',
      };
      await this.documents.save(document);
      this.knowledgeQueue.enqueue(document.id);
    } catch (error: any) {
      this.logger.error(`Pipeline failed for document ${documentId}: ${error.message}`, error.stack);
      document.status = 'failed';
      document.errorMessage = error.message;
      await this.documents.save(document);
    }
  }

  private async reject(document: IngestedDocumentEntity, reasons: string[]): Promise<void> {
    document.status = 'rejected';
    document.needsReview = true;
    document.reviewReasons = reasons;
    await this.documents.save(document);
  }

  private async setStage(
    document: IngestedDocumentEntity,
    stage: StageName,
    state: 'in_progress' | 'completed' | 'failed',
  ): Promise<void> {
    document.stageProgress = { ...(document.stageProgress || {}), [stage]: state };
    await this.documents.save(document);
  }
}




