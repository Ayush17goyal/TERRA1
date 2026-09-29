"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentEngineModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const document_engine_controller_1 = require("./document-engine.controller");
const document_engine_service_1 = require("./document-engine.service");
const document_engine_pipeline_service_1 = require("./document-engine-pipeline.service");
const document_engine_queue_service_1 = require("./document-engine-queue.service");
const ingested_document_entity_1 = require("./entities/ingested-document.entity");
const document_knowledge_record_entity_1 = require("./entities/document-knowledge-record.entity");
const duplicate_detection_gate_1 = require("./gates/duplicate-detection.gate");
const size_bounds_gate_1 = require("./gates/size-bounds.gate");
const language_detection_gate_1 = require("./gates/language-detection.gate");
const non_legal_content_gate_1 = require("./gates/non-legal-content.gate");
const prompt_injection_gate_1 = require("./gates/prompt-injection.gate");
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
const knowledge_engine_module_1 = require("../knowledge-engine/knowledge-engine.module");
const virus_scanner_service_1 = require("../../hardening/security/virus-scanner.service");
let DocumentEngineModule = class DocumentEngineModule {
};
exports.DocumentEngineModule = DocumentEngineModule;
exports.DocumentEngineModule = DocumentEngineModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([ingested_document_entity_1.IngestedDocumentEntity, document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity]), knowledge_engine_module_1.KnowledgeEngineModule],
        controllers: [document_engine_controller_1.DocumentEngineController],
        providers: [
            document_engine_service_1.DocumentEngineService,
            document_engine_pipeline_service_1.DocumentEnginePipelineService,
            document_engine_queue_service_1.DocumentEngineQueueService,
            virus_scanner_service_1.VirusScannerService,
            duplicate_detection_gate_1.DuplicateDetectionGate,
            size_bounds_gate_1.SizeBoundsGate,
            language_detection_gate_1.LanguageDetectionGate,
            non_legal_content_gate_1.NonLegalContentGate,
            prompt_injection_gate_1.PromptInjectionGate,
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
        ],
        exports: [document_engine_service_1.DocumentEngineService],
    })
], DocumentEngineModule);
//# sourceMappingURL=document-engine.module.js.map