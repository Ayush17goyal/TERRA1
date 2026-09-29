import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DuplicateDetectionGate } from './duplicate-detection.gate';
import { IngestedDocumentEntity } from '../entities/ingested-document.entity';

// Phase 0.2 smoke test: proves the Jest + ts-jest + @nestjs/testing harness works end-to-end
// before any other spec is written.
describe('DuplicateDetectionGate', () => {
  it('hashes identical bytes identically', async () => {
    const module = await Test.createTestingModule({
      providers: [
        DuplicateDetectionGate,
        { provide: getRepositoryToken(IngestedDocumentEntity), useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    const gate = module.get(DuplicateDetectionGate);
    const a = gate.hash(Buffer.from('hello world'));
    const b = gate.hash(Buffer.from('hello world'));
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // sha256 hex digest length
  });

  it('differs for different bytes', async () => {
    const module = await Test.createTestingModule({
      providers: [
        DuplicateDetectionGate,
        { provide: getRepositoryToken(IngestedDocumentEntity), useValue: { findOne: jest.fn() } },
      ],
    }).compile();
    const gate = module.get(DuplicateDetectionGate);
    expect(gate.hash(Buffer.from('a'))).not.toBe(gate.hash(Buffer.from('b')));
  });

  it('rejects a repeat upload (same user, same content hash) with the existing record', async () => {
    const existing = { id: 'doc-1', userId: 'user-1', contentHash: 'abc' };
    const findOne = jest.fn().mockResolvedValue(existing);
    const module = await Test.createTestingModule({
      providers: [
        DuplicateDetectionGate,
        { provide: getRepositoryToken(IngestedDocumentEntity), useValue: { findOne } },
      ],
    }).compile();
    const gate = module.get(DuplicateDetectionGate);

    const result = await gate.check('user-1', 'abc');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('duplicate_document');
    expect(result.existing).toBe(existing);
    expect(findOne).toHaveBeenCalledWith({ where: { userId: 'user-1', contentHash: 'abc' } });
  });

  it('passes when no existing document matches (different user or different content)', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const module = await Test.createTestingModule({
      providers: [
        DuplicateDetectionGate,
        { provide: getRepositoryToken(IngestedDocumentEntity), useValue: { findOne } },
      ],
    }).compile();
    const gate = module.get(DuplicateDetectionGate);

    const result = await gate.check('user-2', 'abc');
    expect(result.passed).toBe(true);
  });
});
