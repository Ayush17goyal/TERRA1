/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { DocumentPipeline } from '../../documents/services/DocumentPipeline';
import { InMemoryDocumentRepository } from '../../documents/repositories/InMemoryDocumentRepository';

const textParser = { supports: () => true, parse: async (input: any) => ({ text: new TextDecoder('utf-8').decode(input.content), metadata: { title: input.fileName } }) };

function services() {
  const repository = new InMemoryDocumentRepository();
  return {
    repository,
    storage: { upload: async () => ({ storagePath: 'documents/test.txt' }) },
    scanner: { scan: async () => ({ safe: true }) },
    parsers: [textParser],
    embeddings: { generateBatchEmbeddings: async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3]) },
    indexer: { indexed: [] as unknown[], async index(chunks: unknown[]) { this.indexed.push(...chunks); } },
  };
}

describe('DocumentPipeline', () => {
  it('validates, classifies, chunks, embeds, and indexes an uploaded Bare Act', async () => {
    const deps = services();
    const result = await new DocumentPipeline({ services: deps as any }).process({ userId: 'student-1', fileName: 'Example Bare Act.txt', mimeType: 'text/plain', content: new TextEncoder().encode('Example Act\nSection 1. Short title and commencement.\nSection 2. Definitions.'), declaredType: 'bare_act' });
    expect(result.document.status).toBe('indexed');
    expect(result.classification.documentType).toBe('bare_act');
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(deps.indexer.indexed.length).toBe(result.chunks.length);
  });
});

