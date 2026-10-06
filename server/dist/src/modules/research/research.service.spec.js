"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const research_service_1 = require("./research.service");
describe('ResearchService upload responsiveness', () => {
    it('returns after extraction and storage without waiting for embeddings', async () => {
        let resolveEmbeddings;
        const embeddingsPending = new Promise((resolve) => { resolveEmbeddings = resolve; });
        const documentRepository = {
            create: jest.fn((value) => ({ id: 'document-1', ...value })),
            save: jest.fn(async (value) => value),
        };
        const embeddingProvider = {
            generateBatchEmbeddings: jest.fn(() => embeddingsPending),
        };
        const upsert = jest.fn(async () => ({ status: 'ok' }));
        const qdrantService = { getClient: jest.fn(() => ({ upsert })) };
        const service = new research_service_1.ResearchService(null, null, null, null, null, null, null, documentRepository, null, embeddingProvider, qdrantService, null, null, null, null, null);
        const upload = service.uploadDocument('user-1', { originalname: 'Moot Problem.txt', buffer: Buffer.from('A sufficiently complete moot proposition.') }, undefined, 'Moot Proposition');
        const result = await Promise.race([
            upload,
            new Promise((_, reject) => setTimeout(() => reject(new Error('upload response blocked on indexing')), 250)),
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
//# sourceMappingURL=research.service.spec.js.map