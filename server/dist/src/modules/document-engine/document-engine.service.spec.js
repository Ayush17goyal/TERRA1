"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const fs = require("fs");
const path = require("path");
const document_engine_service_1 = require("./document-engine.service");
const duplicate_detection_gate_1 = require("./gates/duplicate-detection.gate");
const document_engine_queue_service_1 = require("./document-engine-queue.service");
const virus_scanner_service_1 = require("../../hardening/security/virus-scanner.service");
const ingested_document_entity_1 = require("./entities/ingested-document.entity");
const document_knowledge_record_entity_1 = require("./entities/document-knowledge-record.entity");
describe('DocumentEngineService (integration)', () => {
    let service;
    let documents;
    const enqueue = jest.fn();
    const scanBuffer = jest.fn(async () => ({ clean: true, engine: 'test-scanner', details: 'clean' }));
    const storageRoot = path.resolve(process.cwd(), 'uploads', 'document-engine');
    beforeAll(async () => {
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
                document_engine_service_1.DocumentEngineService,
                duplicate_detection_gate_1.DuplicateDetectionGate,
                { provide: document_engine_queue_service_1.DocumentEngineQueueService, useValue: { enqueue } },
                { provide: virus_scanner_service_1.VirusScannerService, useValue: { scanBuffer } },
            ],
        }).compile();
        service = module.get(document_engine_service_1.DocumentEngineService);
        documents = module.get((0, typeorm_1.getRepositoryToken)(ingested_document_entity_1.IngestedDocumentEntity));
    });
    afterEach(() => {
        enqueue.mockClear();
        scanBuffer.mockClear();
        scanBuffer.mockResolvedValue({ clean: true, engine: 'test-scanner', details: 'clean' });
    });
    afterAll(() => {
        fs.rmSync(storageRoot, { recursive: true, force: true });
    });
    function file(buffer, name = 'notes.txt') {
        return { originalname: name, mimetype: 'text/plain', size: buffer.length, buffer };
    }
    it('scans uploads before writing to storage or enqueueing processing', async () => {
        scanBuffer.mockResolvedValueOnce({ clean: false, engine: 'test-scanner', details: 'malware signature' });
        await expect(service.submit('user-scan', file(Buffer.from('unsafe bytes'), 'unsafe.txt'))).rejects.toThrow(/virus scanner/i);
        expect(enqueue).not.toHaveBeenCalled();
        const all = await documents.find({ where: { userId: 'user-scan' } });
        expect(all).toHaveLength(0);
    });
    it('creates a new document and enqueues processing for a first-time upload', async () => {
        const result = await service.submit('user-1', file(Buffer.from('First upload content.')));
        expect(result.status).toBe('queued');
        expect(enqueue).toHaveBeenCalledWith(result.id);
        const all = await documents.find({ where: { userId: 'user-1' } });
        expect(all).toHaveLength(1);
    });
    it('short-circuits an exact repeat upload (same user, same bytes) to the existing record, without re-enqueueing', async () => {
        const buffer = Buffer.from('Repeatable content for duplicate check.');
        const first = await service.submit('user-2', file(buffer, 'a.txt'));
        enqueue.mockClear();
        const second = await service.submit('user-2', file(buffer, 'a.txt'));
        expect(second.id).toBe(first.id);
        expect(enqueue).not.toHaveBeenCalled();
        const all = await documents.find({ where: { userId: 'user-2' } });
        expect(all).toHaveLength(1);
    });
    it('does not short-circuit the same bytes uploaded by a different user', async () => {
        const buffer = Buffer.from('Shared content, different owners.');
        await service.submit('user-3', file(buffer));
        const other = await service.submit('user-4', file(buffer));
        expect(enqueue).toHaveBeenCalledTimes(2);
        expect(other.userId).toBe('user-4');
    });
});
//# sourceMappingURL=document-engine.service.spec.js.map