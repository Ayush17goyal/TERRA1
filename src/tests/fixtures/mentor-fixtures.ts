import type { PromptAssemblyRequest } from '../../ai/prompts/types';
import type { RuntimeDecisionPacket, LLMResponse } from '../../llm/types';
import type { KnowledgeDocument, KnowledgeRepository, RetrievalCandidate, RetrievalQuery, EmbeddingService } from '../../knowledge/types';

export function promptRequest(overrides: Partial<PromptAssemblyRequest> = {}): PromptAssemblyRequest {
  return {
    userMessage: 'Teach me how to draft a definitions clause.',
    intent: 'learning',
    teachingStrategy: 'teach',
    productName: 'Bare Act Drafting Mentor',
    platformName: 'LEGATRIXON',
    defaultJurisdiction: 'India',
    curriculum: { moduleId: 'm1', moduleTitle: 'Definitions', lessonId: 'l1', lessonTitle: 'Definitions Basics', learningOutcomes: ['Identify when a term needs definition'], masteryCriteria: ['Student revises one definition'] },
    student: { level: 'beginner', knownWeaknesses: ['overbroad terms'], masteredSkills: ['short title'] },
    patterns: [{ name: 'Definitions', purpose: 'Control meaning', commonMistakes: ['Defining unused terms'], reviewChecklist: ['Term is used', 'Meaning is stable'] }],
    safety: { allowedAssistanceLevel: 'hint_only', jurisdictionConfidence: 'medium', sourceGroundingStatus: 'grounded' },
    output: { requiredSections: ['Learning objective', 'Next action'], includeNextAction: true, maxLength: 'medium' },
    totalTokenBudget: 3500,
    ...overrides,
  };
}

export function runtimePacket(overrides: Partial<RuntimeDecisionPacket> = {}): RuntimeDecisionPacket {
  const request = promptRequest(overrides.promptRequest as Partial<PromptAssemblyRequest> | undefined);
  return {
    requestId: 'req-1',
    interactionId: 'int-1',
    studentId: 'student-1',
    intent: request.intent,
    teachingStrategy: request.teachingStrategy,
    promptRequest: request,
    model: 'gpt-test',
    ...overrides,
  };
}

export function llmResponse(text = 'Learning objective: improve definitions drafting. Strengths: clear intent. Weaknesses: term scope needs narrowing. Next action: revise one definition.'): LLMResponse {
  const packet = runtimePacket();
  return {
    requestId: packet.requestId,
    interactionId: packet.interactionId,
    text,
    model: 'gpt-test',
    prompt: { prompt: 'assembled prompt', fragments: [], estimatedTokens: 12, omittedModules: [], warnings: [] },
    toolCalls: [],
    usage: { inputTokens: 12, outputTokens: 18, totalTokens: 30, systemPromptTokens: 4, knowledgeTokens: 4, studentContextTokens: 2, draftTokens: 0 },
    cost: { model: 'gpt-test', inputCostUsd: 0, outputCostUsd: 0, estimatedCostUsd: 0, completionLength: text.length },
    telemetry: { requestId: packet.requestId, interactionId: packet.interactionId, studentId: packet.studentId, intent: packet.intent, teachingStrategy: packet.teachingStrategy, promptVersion: 'test', model: 'gpt-test', latencyMs: 1, retryCount: 0, cacheHit: false, toolCalls: [], usage: { inputTokens: 12, outputTokens: 18, totalTokens: 30, systemPromptTokens: 4, knowledgeTokens: 4, studentContextTokens: 2, draftTokens: 0 }, cost: { model: 'gpt-test', inputCostUsd: 0, outputCostUsd: 0, estimatedCostUsd: 0, completionLength: text.length } },
    raw: { output_text: text },
  };
}

export const knowledgeDocs: KnowledgeDocument[] = [
  { id: 'lesson-1', kind: 'lesson', title: 'Definitions Basics', content: 'A lesson on definitions and interpretation clauses.', metadata: { moduleId: 'm1', lessonId: 'l1', difficulty: 'beginner' } },
  { id: 'pattern-1', kind: 'pattern', title: 'Definitions', content: 'Definitions pattern guidance with checklist and mistakes.', metadata: { patternName: 'Definitions', moduleId: 'm1', lessonId: 'l1', difficulty: 'beginner' } },
  { id: 'rule-1', kind: 'teaching_rule', title: 'No ghostwriting', content: 'Ask for student attempt before model answer.', metadata: { difficulty: 'beginner' } },
  { id: 'bare-1', kind: 'bare_act_component', title: 'Short title section', content: 'Bare Act component structure.', metadata: { componentType: 'short_title', jurisdiction: 'India' } },
];

export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly docs: KnowledgeDocument[];
  constructor(docs: KnowledgeDocument[] = knowledgeDocs) {
    this.docs = docs;
  }
  async searchVector(query: RetrievalQuery): Promise<RetrievalCandidate[]> { return this.search(query, 'vector'); }
  async searchKeyword(query: RetrievalQuery): Promise<RetrievalCandidate[]> { return this.search(query, 'keyword'); }
  async getByIds(ids: string[]): Promise<KnowledgeDocument[]> { return this.docs.filter((doc) => ids.includes(doc.id)); }
  async upsertChunks(): Promise<void> {}
  private async search(query: RetrievalQuery, reason: string): Promise<RetrievalCandidate[]> {
    return this.docs.filter((doc) => query.kinds.includes(doc.kind)).map((document, index) => ({ document, finalScore: 1 - index * 0.05, reasons: [reason] }));
  }
}

export class DeterministicEmbeddingService implements EmbeddingService {
  async generateEmbedding(): Promise<number[]> { return [0.1, 0.2, 0.3]; }
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> { return texts.map(() => [0.1, 0.2, 0.3]); }
  getVectorSize(): number { return 3; }
}
