import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEngineController } from './document-engine.controller';
import { DocumentEngineService } from './document-engine.service';
import { DocumentEnginePipelineService } from './document-engine-pipeline.service';
import { DocumentEngineQueueService } from './document-engine-queue.service';
import { IngestedDocumentEntity } from './entities/ingested-document.entity';
import { DocumentKnowledgeRecordEntity } from './entities/document-knowledge-record.entity';

import { DuplicateDetectionGate } from './gates/duplicate-detection.gate';
import { SizeBoundsGate } from './gates/size-bounds.gate';
import { LanguageDetectionGate } from './gates/language-detection.gate';
import { NonLegalContentGate } from './gates/non-legal-content.gate';
import { PromptInjectionGate } from './gates/prompt-injection.gate';

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
import { KnowledgeEngineModule } from '../knowledge-engine/knowledge-engine.module';
import { VirusScannerService } from '../../hardening/security/virus-scanner.service';

// Backend for the Document Ingestion Engine (architecture.md §3 / "Module 1").
// Self-contained: registers its own entities and depends on no other feature module, per the
// "don't modify other modules" implementation rule.
@Module({
  imports: [TypeOrmModule.forFeature([IngestedDocumentEntity, DocumentKnowledgeRecordEntity]), KnowledgeEngineModule],
  controllers: [DocumentEngineController],
  providers: [
    DocumentEngineService,
    DocumentEnginePipelineService,
    DocumentEngineQueueService,
    VirusScannerService,

    DuplicateDetectionGate,
    SizeBoundsGate,
    LanguageDetectionGate,
    NonLegalContentGate,
    PromptInjectionGate,

    FormatNormalizerStage,
    OcrRecoveryStage,
    TextCleaningStage,
    StructuralSkeletonStage,
    SectionExtractionStage,
    TopicDetectionStage,
    DefinitionExtractionStage,
    IllustrationExtractionStage,
    CaseExtractionStage,
    CitationExtractionStage,
    CrossLinkingStage,
    MetadataAssemblyStage,
  ],
  exports: [DocumentEngineService],
})
export class DocumentEngineModule {}


