"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("@nestjs/typeorm");
const fs = require("fs");
const os = require("os");
const path = require("path");
const document_engine_pipeline_service_1 = require("./document-engine-pipeline.service");
const ingested_document_entity_1 = require("./entities/ingested-document.entity");
const document_knowledge_record_entity_1 = require("./entities/document-knowledge-record.entity");
const knowledge_engine_queue_service_1 = require("../knowledge-engine/knowledge-engine-queue.service");
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
const size_bounds_gate_1 = require("./gates/size-bounds.gate");
const language_detection_gate_1 = require("./gates/language-detection.gate");
const non_legal_content_gate_1 = require("./gates/non-legal-content.gate");
const sample_inputs_1 = require("./__fixtures__/sample-inputs");
jest.mock('pdf-parse', () => jest.fn(), { virtual: true });
describe('DocumentEnginePipelineService (integration)', () => {
    let pipeline;
    let documents;
    let knowledgeRecords;
    const enqueueKnowledge = jest.fn();
    let tmpDir;
    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-engine-test-'));
        const module = await testing_1.Test.createTestingModule({
            imports: [
                typeorm_1.TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [ingested_document_entity_1.IngestedDocumentEntity, document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity],
                    synchronize: true,
                }),
                typeorm_1.TypeOrmModule.forFeature([ingested_document_entity_1.IngestedDocumentEntity, document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity]),
            ],
            providers: [
                document_engine_pipeline_service_1.DocumentEnginePipelineService,
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
                { provide: knowledge_engine_queue_service_1.KnowledgeEngineQueueService, useValue: { enqueue: enqueueKnowledge } },
            ],
        }).compile();
        pipeline = module.get(document_engine_pipeline_service_1.DocumentEnginePipelineService);
        documents = module.get((0, typeorm_2.getRepositoryToken)(ingested_document_entity_1.IngestedDocumentEntity));
        knowledgeRecords = module.get((0, typeorm_2.getRepositoryToken)(document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity));
    });
    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    async function createQueuedDocument(text, filename) {
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
        const doc = await createQueuedDocument(sample_inputs_1.BARE_ACT_TEXT, 'bare-act.txt');
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
        expect(record.retrievableUnits.length).toBeGreaterThan(0);
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
        const doc = await createQueuedDocument(sample_inputs_1.NON_LEGAL_TEXT, 'vacation.txt');
        await pipeline.run(doc.id);
        const final = await documents.findOneByOrFail({ id: doc.id });
        expect(final.status).toBe('rejected');
        expect(final.reviewReasons).toContain('non_legal_content_suspected');
        expect(final.stageProgress.topic_subtopic_detection).toBeUndefined();
        const record = await knowledgeRecords.findOne({ where: { documentId: doc.id } });
        expect(record).toBeNull();
    });
});
//# sourceMappingURL=document-engine-pipeline.service.spec.js.map