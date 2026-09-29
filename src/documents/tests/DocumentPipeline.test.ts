import { DocumentPipeline } from '../services/DocumentPipeline';
import { PlainTextParser } from '../parsing/TextParsers';
import { InMemoryDocumentRepository } from '../repositories/InMemoryDocumentRepository';
import { NoopVirusScanner } from '../upload/VirusScanner';
import type { DocumentChunk, DocumentStorage, UploadedDocumentInput } from '../types';

class MockStorage implements DocumentStorage {
  async upload(input: UploadedDocumentInput, documentId: string, version: number) {
    return { storagePath: `${input.userId}/${documentId}/v${version}/${input.fileName}`, sizeBytes: input.content.byteLength };
  }
}

class MockEmbeddings {
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map((text) => [text.length, 1, 0]);
  }
}

class MockIndexer {
  readonly chunks: DocumentChunk[] = [];
  async index(chunks: DocumentChunk[]): Promise<void> {
    this.chunks.push(...chunks);
  }
}

export async function testPipelineIndexesBareActText(): Promise<void> {
  const indexer = new MockIndexer();
  const pipeline = new DocumentPipeline({
    services: {
      storage: new MockStorage(),
      repository: new InMemoryDocumentRepository(),
      scanner: new NoopVirusScanner(),
      parsers: [new PlainTextParser()],
      embeddings: new MockEmbeddings(),
      indexer,
    },
  });

  const result = await pipeline.process({
    fileName: 'test.txt',
    mimeType: 'text/plain',
    userId: 'student-1',
    declaredType: 'bare_act',
    content: new TextEncoder().encode('An Act to teach drafting\n\n1. Short title and commencement.\n\n2. Definitions. In this Act, mentor means teacher.'),
  });

  assert(result.document.status === 'indexed', 'Expected indexed status.');
  assert(result.classification.documentType === 'bare_act', 'Expected Bare Act classification.');
  assert(result.chunks.length > 0, 'Expected generated chunks.');
  assert(indexer.chunks.length === result.chunks.length, 'Expected chunks to be indexed.');
}

export async function testPipelineDetectsDuplicateChecksum(): Promise<void> {
  const repository = new InMemoryDocumentRepository();
  const pipeline = new DocumentPipeline({
    services: {
      storage: new MockStorage(),
      repository,
      scanner: new NoopVirusScanner(),
      parsers: [new PlainTextParser()],
      embeddings: new MockEmbeddings(),
      indexer: new MockIndexer(),
    },
  });
  const input = {
    fileName: 'note.txt',
    mimeType: 'text/plain',
    userId: 'student-1',
    declaredType: 'notes' as const,
    content: new TextEncoder().encode('drafting notes'),
  };
  await pipeline.process(input);
  const second = await pipeline.process(input);
  assert(second.duplicate === true, 'Expected duplicate detection.');
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}
