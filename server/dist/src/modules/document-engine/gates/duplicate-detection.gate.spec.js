"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const duplicate_detection_gate_1 = require("./duplicate-detection.gate");
const ingested_document_entity_1 = require("../entities/ingested-document.entity");
describe('DuplicateDetectionGate', () => {
    it('hashes identical bytes identically', async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                duplicate_detection_gate_1.DuplicateDetectionGate,
                { provide: (0, typeorm_1.getRepositoryToken)(ingested_document_entity_1.IngestedDocumentEntity), useValue: { findOne: jest.fn() } },
            ],
        }).compile();
        const gate = module.get(duplicate_detection_gate_1.DuplicateDetectionGate);
        const a = gate.hash(Buffer.from('hello world'));
        const b = gate.hash(Buffer.from('hello world'));
        expect(a).toBe(b);
        expect(a).toHaveLength(64);
    });
    it('differs for different bytes', async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                duplicate_detection_gate_1.DuplicateDetectionGate,
                { provide: (0, typeorm_1.getRepositoryToken)(ingested_document_entity_1.IngestedDocumentEntity), useValue: { findOne: jest.fn() } },
            ],
        }).compile();
        const gate = module.get(duplicate_detection_gate_1.DuplicateDetectionGate);
        expect(gate.hash(Buffer.from('a'))).not.toBe(gate.hash(Buffer.from('b')));
    });
    it('rejects a repeat upload (same user, same content hash) with the existing record', async () => {
        const existing = { id: 'doc-1', userId: 'user-1', contentHash: 'abc' };
        const findOne = jest.fn().mockResolvedValue(existing);
        const module = await testing_1.Test.createTestingModule({
            providers: [
                duplicate_detection_gate_1.DuplicateDetectionGate,
                { provide: (0, typeorm_1.getRepositoryToken)(ingested_document_entity_1.IngestedDocumentEntity), useValue: { findOne } },
            ],
        }).compile();
        const gate = module.get(duplicate_detection_gate_1.DuplicateDetectionGate);
        const result = await gate.check('user-1', 'abc');
        expect(result.passed).toBe(false);
        expect(result.reason).toBe('duplicate_document');
        expect(result.existing).toBe(existing);
        expect(findOne).toHaveBeenCalledWith({ where: { userId: 'user-1', contentHash: 'abc' } });
    });
    it('passes when no existing document matches (different user or different content)', async () => {
        const findOne = jest.fn().mockResolvedValue(null);
        const module = await testing_1.Test.createTestingModule({
            providers: [
                duplicate_detection_gate_1.DuplicateDetectionGate,
                { provide: (0, typeorm_1.getRepositoryToken)(ingested_document_entity_1.IngestedDocumentEntity), useValue: { findOne } },
            ],
        }).compile();
        const gate = module.get(duplicate_detection_gate_1.DuplicateDetectionGate);
        const result = await gate.check('user-2', 'abc');
        expect(result.passed).toBe(true);
    });
});
//# sourceMappingURL=duplicate-detection.gate.spec.js.map