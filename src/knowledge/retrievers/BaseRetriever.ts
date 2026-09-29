import type { KnowledgeKind, KnowledgeRetrievalRequest, RetrieverPlan, RetrievalMode } from '../types';

export interface RetrieverOptions {
  name: string;
  kinds: KnowledgeKind[];
  mode?: RetrievalMode;
  limit?: number;
  tokenBudget?: number;
}

export class BaseRetriever {
  readonly name: string;
  readonly kinds: KnowledgeKind[];
  private readonly mode: RetrievalMode;
  private readonly limit: number;
  private readonly tokenBudget: number;

  constructor(options: RetrieverOptions) {
    this.name = options.name;
    this.kinds = options.kinds;
    this.mode = options.mode ?? 'hybrid';
    this.limit = options.limit ?? 6;
    this.tokenBudget = options.tokenBudget ?? 1200;
  }

  buildPlan(request: KnowledgeRetrievalRequest): RetrieverPlan {
    const text = [
      request.normalizedMessage ?? request.userMessage,
      request.currentModuleTitle,
      request.currentLessonTitle,
      request.patternNames?.join(' '),
      request.componentTypes?.join(' '),
    ].filter(Boolean).join('\n');

    return {
      retrieverName: this.name,
      query: {
        text,
        intent: request.intent,
        teachingStrategy: request.teachingStrategy,
        studentLevel: request.studentLevel,
        kinds: this.kinds,
        mode: this.mode,
        filters: this.buildFilters(request),
        limit: this.limit,
        tokenBudget: this.tokenBudget,
        recencyBoost: this.usesRecency(),
      },
    };
  }

  protected buildFilters(request: KnowledgeRetrievalRequest): Record<string, unknown> {
    const filters: Record<string, unknown> = {};

    if (request.courseId) filters.courseId = request.courseId;
    if (request.moduleId) filters.moduleId = request.moduleId;
    if (request.lessonId) filters.lessonId = request.lessonId;
    if (request.jurisdiction) filters.jurisdiction = request.jurisdiction;
    if (request.difficulty) filters.difficulty = request.difficulty;

    return filters;
  }

  protected usesRecency(): boolean {
    return false;
  }
}
