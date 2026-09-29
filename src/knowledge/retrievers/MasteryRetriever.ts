import type { KnowledgeRetrievalRequest } from '../types';
import { BaseRetriever } from './BaseRetriever';

export class MasteryRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'MasteryRetriever', kinds: ['mastery'], mode: 'keyword', limit: 4, tokenBudget: 700 });
  }

  protected buildFilters(request: KnowledgeRetrievalRequest): Record<string, unknown> {
    return {
      ...(request.userId ? { userId: request.userId } : {}),
      ...(request.moduleId ? { moduleId: request.moduleId } : {}),
      ...(request.lessonId ? { lessonId: request.lessonId } : {}),
    };
  }
}
