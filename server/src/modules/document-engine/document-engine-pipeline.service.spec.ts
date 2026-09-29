import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DocumentEnginePipelineService } from './document-engine-pipeline.service';
import { IngestedDocumentEntity } from './entities/ingested-document.entity';
import { DocumentKnowledgeRecordEntity } from './entities/document-knowledge-record.entity';
import { KnowledgeEngineQueueService } from '../knowledge-engine/knowledge-engine-queue.service';

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
import { SizeBoundsGate } from './gates/size-bounds.gate';
import { LanguageDetectionGate } from './gates/language-detection.gate';
import { NonLegalContentGate } from './gates/non-legal-content.gate';
import { BARE_ACT_TEXT, NON_LEGAL_TEXT } from './__fixtures__/sample-inputs';

jest.mock('pdf-parse', () => jest.fn(), { virtual: true });

describe('DocumentEnginePipelineService (integration)', () => {
  let pipeline: DocumentEnginePipelineService;
  let documents: Repository<IngestedDocumentEntity>;
  let knowledgeRecords: Repository<DocumentKnowledgeRecordEntity>;
  const enqueueKnowledge = jest.fn();
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-engine-test-'));

    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [IngestedDocumentEntity, DocumentKnowledgeRecordEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([IngestedDocumentEntity, DocumentKnowledgeRecordEntity]),
      ],
      providers: [
        DocumentEnginePipelineService,
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
        SizeBoundsGate,
        LanguageDetectionGate,
        NonLegalContentGate,
        { provide: KnowledgeEngineQueueService, useValue: { enqueue: enqueueKnowledge } },
      ],
    }).compile();

    pipeline = module.get(DocumentEnginePipelineService);
    documents = module.get(getRepositoryToken(IngestedDocumentEntity));
    knowledgeRecords = module.get(getRepositoryToken(DocumentKnowledgeRecordEntity));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function createQueuedDocument(text: string, filename: string): Promise<IngestedDocumentEntity> {
    const storagePath = path.join(tmpDir, filename);
    fs.writeFileSync(storagePath, text, 'utf8');
    const doc = documents.create({
      userId: 'user-1',
      originalFilename: filename,
      mimeType: 'text/plain',
      sizeBytes: Buffer.byteLength(text),
      contentHash: `hash-${filename}`,
      status: 'queued',
      stageProgress: {},
      storagePath,
    });
    return documents.save(doc);
  }

  it('completes the full pipeline for a legal document and persists a KnowledgeBaseRecord', async () => {
    const doc = await createQueuedDocument(BARE_ACT_TEXT, 'bare-act.txt');

    await pipeline.run(doc.id);

    const final = await documents.findOneByOrFail({ id: doc.id });
    expect(final.status).toBe('building_knowledge');
    expect(enqueueKnowledge).toHaveBeenCalledWith(doc.id);
    const expectedStages = [
      'format_normalization',
      'ocr_recovery',
      'text_cleaning',
      'structural_skeleton',
      'section_extraction',
      'topic_subtopic_detection',
      'entity_extraction',
      'cross_linking',
      'metadata_assembly',
    ];
    for (const stage of expectedStages) {
      expect(final.stageProgress[stage]).toBe('completed');
    }

    const record = await knowledgeRecords.findOne({ where: { documentId: doc.id } });
    expect(record).not.toBeNull();
    expect(record!.retrievableUnits.length).toBeGreaterThan(0);
  });

  it('rejects a near-empty document before the understanding phase, with no KnowledgeBaseRecord created', async () => {
    const doc = await createQueuedDocument('short', 'tiny.txt');

    await pipeline.run(doc.id);

    const final = await documents.findOneByOrFail({ id: doc.id });
    expect(final.status).toBe('rejected');
    expect(final.reviewReasons).toContain('insufficient_extractable_content');
    expect(final.stageProgress.structural_skeleton).toBeUndefined();

    const record = await knowledgeRecords.findOne({ where: { documentId: doc.id } });
    expect(record).toBeNull();
  });

  it('rejects a non-legal document before Stage 5, with no KnowledgeBaseRecord created', async () => {
    const doc = await createQueuedDocument(NON_LEGAL_TEXT, 'vacation.txt');

    await pipeline.run(doc.id);

    const final = await documents.findOneByOrFail({ id: doc.id });
    expect(final.status).toBe('rejected');
    expect(final.reviewReasons).toContain('non_legal_content_suspected');
    expect(final.stageProgress.topic_subtopic_detection).toBeUndefined();

    const record = await knowledgeRecords.findOne({ where: { documentId: doc.id } });
    expect(record).toBeNull();
  });
});



