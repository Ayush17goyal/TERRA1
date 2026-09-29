import { KnowledgeRetrievalEngine } from '../engine/KnowledgeRetrievalEngine';
import type {
  EmbeddingService,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeRepository,
  RetrievalCandidate,
  RetrievalQuery,
} from '../types';

class TestEmbeddingService implements EmbeddingService {
  getVectorSize(): number {
    return 3;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const seed = text.length || 1;
    return [seed % 3, seed % 5, seed % 7];
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.generateEmbedding(text)));
  }
}

class TestKnowledgeRepository implements KnowledgeRepository {
  private readonly documents: KnowledgeDocument[];

  constructor(documents: KnowledgeDocument[]) {
    this.documents = documents;
  }

  async searchVector(query: RetrievalQuery): Promise<RetrievalCandidate[]> {
    return this.filter(query).map((document, index) => ({
      document,
      vectorScore: 1 - index * 0.05,
      finalScore: 1 - index * 0.05,
      reasons: ['test_vector'],
    }));
  }

  async searchKeyword(query: RetrievalQuery): Promise<RetrievalCandidate[]> {
    const terms = query.text.toLowerCase().split(/\W+/).filter(Boolean);
    return this.filter(query)
      .filter((document) => terms.some((term) => document.content.toLowerCase().includes(term)))
      .map((document) => ({
        document,
        keywordScore: 0.8,
        finalScore: 0.8,
        reasons: ['test_keyword'],
      }));
  }

  async getByIds(ids: string[]): Promise<KnowledgeDocument[]> {
    return this.documents.filter((document) => ids.includes(document.id));
  }

  async upsertChunks(chunks: KnowledgeChunk[]): Promise<void> {
    this.documents.push(...chunks);
  }

  private filter(query: RetrievalQuery): KnowledgeDocument[] {
    return this.documents.filter((document) => query.kinds.includes(document.kind));
  }
}

const fixtureDocuments: KnowledgeDocument[] = [
  {
    id: 'pattern-definitions',
    kind: 'pattern',
    title: 'Definitions Pattern',
    content: 'Definitions assign controlled statutory meaning to recurring terms and prevent inconsistent usage.',
    metadata: { patternName: 'Definitions', moduleId: 'definitions', lessonId: 'definition-basics' },
  },
  {
    id: 'lesson-definitions',
    kind: 'lesson',
    title: 'Definitions Lesson',
    content: 'Students must learn when a term needs definition and when ordinary meaning is enough.',
    metadata: { moduleId: 'definitions', lessonId: 'definition-basics' },
  },
  {
    id: 'feedback-1',
    kind: 'previous_feedback',
    title: 'Prior Feedback',
    content: 'The previous draft hid a substantive rule inside the definition.',
    metadata: { userId: 'user-1', draftId: 'draft-1', updatedAt: new Date().toISOString() },
  },
];

export async function testRetrieveForLearningIncludesCurriculumKnowledge(): Promise<void> {
  const engine = new KnowledgeRetrievalEngine({
    repository: new TestKnowledgeRepository([...fixtureDocuments]),
    embeddingService: new TestEmbeddingService(),
  });

  const result = await engine.retrieveForLearning({
    userMessage: 'What is a definition clause?',
    intent: 'learning',
    teachingStrategy: 'teach',
    studentLevel: 'beginner',
    moduleId: 'definitions',
    lessonId: 'definition-basics',
  });

  assert(result.items.some((item) => item.kind === 'lesson'), 'Expected lesson context.');
  assert(result.items.some((item) => item.kind === 'pattern'), 'Expected pattern context.');
}

export async function testRetrieveForRevisionPrioritizesFeedback(): Promise<void> {
  const engine = new KnowledgeRetrievalEngine({
    repository: new TestKnowledgeRepository([...fixtureDocuments]),
    embeddingService: new TestEmbeddingService(),
  });

  const result = await engine.retrieveForRevision({
    userId: 'user-1',
    draftId: 'draft-1',
    userMessage: 'Is my definition revision better?',
    intent: 'revision',
    teachingStrategy: 'revision_guidance',
    studentLevel: 'intermediate',
  });

  assert(result.items.some((item) => item.kind === 'previous_feedback'), 'Expected previous feedback context.');
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
