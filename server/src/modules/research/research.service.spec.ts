import { ResearchService } from './research.service';

describe('ResearchService upload responsiveness', () => {
  it('returns after extraction and storage without waiting for embeddings', async () => {
    let resolveEmbeddings!: (value: number[][]) => void;
    const embeddingsPending = new Promise<number[][]>((resolve) => { resolveEmbeddings = resolve; });
    const documentRepository = {
      create: jest.fn((value) => ({ id: 'document-1', ...value })),
      save: jest.fn(async (value) => value),
    };
    const embeddingProvider = {
      generateBatchEmbeddings: jest.fn(() => embeddingsPending),
    };
    const upsert = jest.fn(async () => ({ status: 'ok' }));
    const qdrantService = { getClient: jest.fn(() => ({ upsert })) };

    const service = new ResearchService(
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      documentRepository as any,
      null as any,
      embeddingProvider as any,
      qdrantService as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
    );

    const upload = service.uploadDocument(
      'user-1',
      { originalname: 'Moot Problem.txt', buffer: Buffer.from('A sufficiently complete moot proposition.') },
      undefined,
      'Moot Proposition',
    );
    const result = await Promise.race([
      upload,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('upload response blocked on indexing')), 250)),
    ]);

    expect(result.status).toBe('Processing');
    expect(embeddingProvider.generateBatchEmbeddings).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();

    resolveEmbeddings([[0.1, 0.2, 0.3]]);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(documentRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Ready' }));
  });
});
