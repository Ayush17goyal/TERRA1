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
var DocumentEnginePipelineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentEnginePipelineService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fs = require("fs");
const ingested_document_entity_1 = require("./entities/ingested-document.entity");
const document_knowledge_record_entity_1 = require("./entities/document-knowledge-record.entity");
const format_normalizer_stage_1 = require("./stages/format-normalizer.stage");
const ocr_recovery_stage_1 = require("./stages/ocr-recovery.stage");
const text_cleaning_stage_1 = require("./stages/text-cleaning.stage");
const structural_skeleton_stage_1 = require("./stages/structural-skeleton.stage");
const section_extraction_stage_1 = require("./stages/section-extraction.stage");
const topic_detection_stage_1 = require("./stages/topic-detection.stage");
const definition_extraction_stage_1 = require("./stages/definition-extraction.stage");
const illustration_extraction_stage_1 = require("./stages/illustration-extraction.stage");
const case_extraction_stage_1 = require("./stages/case-extraction.stage");
const citation_extraction_stage_1 = require("./stages/citation-extraction.stage");
const cross_linking_stage_1 = require("./stages/cross-linking.stage");
const metadata_assembly_stage_1 = require("./stages/metadata-assembly.stage");
const knowledge_engine_queue_service_1 = require("../knowledge-engine/knowledge-engine-queue.service");
const size_bounds_gate_1 = require("./gates/size-bounds.gate");
const language_detection_gate_1 = require("./gates/language-detection.gate");
const non_legal_content_gate_1 = require("./gates/non-legal-content.gate");
let DocumentEnginePipelineService = DocumentEnginePipelineService_1 = class DocumentEnginePipelineService {
    constructor(documents, knowledgeRecords, formatNormalizer, ocrRecovery, textCleaning, structuralSkeleton, sectionExtraction, topicDetection, definitionExtraction, illustrationExtraction, caseExtraction, citationExtraction, crossLinking, metadataAssembly, sizeBoundsGate, languageDetectionGate, nonLegalContentGate, knowledgeQueue) {
        this.documents = documents;
        this.knowledgeRecords = knowledgeRecords;
        this.formatNormalizer = formatNormalizer;
        this.ocrRecovery = ocrRecovery;
        this.textCleaning = textCleaning;
        this.structuralSkeleton = structuralSkeleton;
        this.sectionExtraction = sectionExtraction;
        this.topicDetection = topicDetection;
        this.definitionExtraction = definitionExtraction;
        this.illustrationExtraction = illustrationExtraction;
        this.caseExtraction = caseExtraction;
        this.citationExtraction = citationExtraction;
        this.crossLinking = crossLinking;
        this.metadataAssembly = metadataAssembly;
        this.sizeBoundsGate = sizeBoundsGate;
        this.languageDetectionGate = languageDetectionGate;
        this.nonLegalContentGate = nonLegalContentGate;
        this.knowledgeQueue = knowledgeQueue;
        this.logger = new common_1.Logger(DocumentEnginePipelineService_1.name);
    }
    async run(documentId) {
        const document = await this.documents.findOneByOrFail({ id: documentId });
        try {
            await this.setStage(document, 'format_normalization', 'in_progress');
            const buffer = fs.readFileSync(document.storagePath);
            let normalized = await this.formatNormalizer.normalize(buffer, document.mimeType, document.originalFilename);
            await this.setStage(document, 'format_normalization', 'completed');
            const sizeCheck = this.sizeBoundsGate.checkMinimumContent(normalized);
            if (!sizeCheck.passed) {
                await this.reject(document, [sizeCheck.reason]);
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
            const fullText = cleaned.blocks.map((b) => b.text).join('\n');
            const nonLegalCheck = this.nonLegalContentGate.check(fullText, tree);
            if (!nonLegalCheck.passed) {
                await this.reject(document, [nonLegalCheck.reason]);
                return;
            }
            await this.setStage(document, 'section_extraction', 'in_progress');
            const sections = this.sectionExtraction.extract(cleaned, tree);
            await this.setStage(document, 'section_extraction', 'completed');
            await this.documents.save(document);
            document.status = 'understanding';
            await this.documents.save(document);
            await this.setStage(document, 'topic_subtopic_detection', 'in_progress');
            const topicTags = {};
            const subtopicTags = {};
            const examConstructs = [];
            for (const section of sections) {
                const topics = this.topicDetection.classifyTopics(section);
                topicTags[section.id] = topics;
                subtopicTags[section.id] = this.topicDetection.classifySubtopics(section, topics);
                examConstructs.push(...this.topicDetection.detectConstructs(section));
            }
            await this.setStage(document, 'topic_subtopic_detection', 'completed');
            await this.setStage(document, 'entity_extraction', 'in_progress');
            const definitions = [];
            const cases = [];
            for (const section of sections) {
                definitions.push(...this.definitionExtraction.extract(section, tree.documentType));
                cases.push(...this.caseExtraction.extract(section, tree.documentType));
            }
            const illustrations = [];
            const citations = [];
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
            await this.knowledgeRecords.save(this.knowledgeRecords.create({
                documentId: document.id,
                graph: record.graph,
                retrievableUnits: record.retrievableUnits,
                dominantTopics: record.dominantTopics,
            }));
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
        }
        catch (error) {
            this.logger.error(`Pipeline failed for document ${documentId}: ${error.message}`, error.stack);
            document.status = 'failed';
            document.errorMessage = error.message;
            await this.documents.save(document);
        }
    }
    async reject(document, reasons) {
        document.status = 'rejected';
        document.needsReview = true;
        document.reviewReasons = reasons;
        await this.documents.save(document);
    }
    async setStage(document, stage, state) {
        document.stageProgress = { ...(document.stageProgress || {}), [stage]: state };
        await this.documents.save(document);
    }
};
exports.DocumentEnginePipelineService = DocumentEnginePipelineService;
exports.DocumentEnginePipelineService = DocumentEnginePipelineService = DocumentEnginePipelineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ingested_document_entity_1.IngestedDocumentEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        format_normalizer_stage_1.FormatNormalizerStage,
        ocr_recovery_stage_1.OcrRecoveryStage,
        text_cleaning_stage_1.TextCleaningStage,
        structural_skeleton_stage_1.StructuralSkeletonStage,
        section_extraction_stage_1.SectionExtractionStage,
        topic_detection_stage_1.TopicDetectionStage,
        definition_extraction_stage_1.DefinitionExtractionStage,
        illustration_extraction_stage_1.IllustrationExtractionStage,
        case_extraction_stage_1.CaseExtractionStage,
        citation_extraction_stage_1.CitationExtractionStage,
        cross_linking_stage_1.CrossLinkingStage,
        metadata_assembly_stage_1.MetadataAssemblyStage,
        size_bounds_gate_1.SizeBoundsGate,
        language_detection_gate_1.LanguageDetectionGate,
        non_legal_content_gate_1.NonLegalContentGate,
        knowledge_engine_queue_service_1.KnowledgeEngineQueueService])
], DocumentEnginePipelineService);
//# sourceMappingURL=document-engine-pipeline.service.js.map