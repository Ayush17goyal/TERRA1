import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentEngineService } from './document-engine.service';
import { DuplicateDetectionGate } from './gates/duplicate-detection.gate';
import { DocumentEngineQueueService } from './document-engine-queue.service';
import { VirusScannerService } from '../../hardening/security/virus-scanner.service';
import { IngestedDocumentEntity } from './entities/ingested-document.entity';
import { DocumentKnowledgeRecordEntity } from './entities/document-knowledge-record.entity';

describe('DocumentEngineService (integration)', () => {
  let service: DocumentEngineService;
  let documents: Repository<IngestedDocumentEntity>;
  const enqueue = jest.fn();
  const scanBuffer = jest.fn(async () => ({ clean: true, engine: 'test-scanner', details: 'clean' }));
  // DocumentEngineService writes uploaded files under process.cwd()/uploads/document-engine —
  // there's no injectable storage root, so this test cleans up that real directory afterward
  // rather than leaving test-user upload artifacts behind in the repo working tree.
  const storageRoot = path.resolve(process.cwd(), 'uploads', 'document-engine');

  beforeAll(async () => {
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
        DocumentEngineService,
        DuplicateDetectionGate,
        { provide: DocumentEngineQueueService, useValue: { enqueue } },
        { provide: VirusScannerService, useValue: { scanBuffer } },
      ],
    }).compile();

    service = module.get(DocumentEngineService);
    documents = module.get(getRepositoryToken(IngestedDocumentEntity));
  });

  afterEach(() => {
    enqueue.mockClear();
    scanBuffer.mockClear();
    scanBuffer.mockResolvedValue({ clean: true, engine: 'test-scanner', details: 'clean' });
  });

  afterAll(() => {
    fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  function file(buffer: Buffer, name = 'notes.txt') {
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
