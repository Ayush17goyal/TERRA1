import { Test } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DocumentEngineController } from './document-engine.controller';
import { DocumentEngineService } from './document-engine.service';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';

describe('DocumentEngineController', () => {
  const service = {
    submit: jest.fn(),
    listForUser: jest.fn(),
    getStatus: jest.fn(),
    getKnowledgeRecord: jest.fn(),
  };
  let controller: DocumentEngineController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [DocumentEngineController],
      providers: [{ provide: DocumentEngineService, useValue: service }],
    }).compile();
    controller = module.get(DocumentEngineController);
  });

  it('applies ClerkAuthGuard at the controller level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, DocumentEngineController);
    expect(guards).toContain(ClerkAuthGuard);
  });

  it('upload() passes the authenticated user id, file, and hint through to the service', async () => {
    const req = { user: { id: 'user-1' } };
    const file = { originalname: 'a.pdf' };
    service.submit.mockResolvedValue({ id: 'doc-1' });

    const result = await controller.upload(file, { documentTypeHint: 'bare_act' }, req);

    expect(service.submit).toHaveBeenCalledWith('user-1', file, 'bare_act');
    expect(result).toEqual({ id: 'doc-1' });
  });

  it('list() scopes to the authenticated user id', async () => {
    const req = { user: { id: 'user-1' } };
    service.listForUser.mockResolvedValue([{ id: 'doc-1' }]);

    const result = await controller.list(req);

    expect(service.listForUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([{ id: 'doc-1' }]);
  });

  it('status() delegates to the service with user id and document id', async () => {
    const req = { user: { id: 'user-1' } };
    service.getStatus.mockResolvedValue({ id: 'doc-1', status: 'processing' });

    const result = await controller.status('doc-1', req);

    expect(service.getStatus).toHaveBeenCalledWith('user-1', 'doc-1');
    expect(result).toEqual({ id: 'doc-1', status: 'processing' });
  });

  it('record() delegates to the service with user id and document id', async () => {
    const req = { user: { id: 'user-1' } };
    service.getKnowledgeRecord.mockResolvedValue({ documentId: 'doc-1' });

    const result = await controller.record('doc-1', req);

    expect(service.getKnowledgeRecord).toHaveBeenCalledWith('user-1', 'doc-1');
    expect(result).toEqual({ documentId: 'doc-1' });
  });
});
