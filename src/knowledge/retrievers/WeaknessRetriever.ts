import type { KnowledgeRetrievalRequest } from '../types';
import { BaseRetriever } from './BaseRetriever';

export class WeaknessRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'WeaknessRetriever', kinds: ['weakness'], mode: 'keyword', limit: 5, tokenBudget: 800 });
  }

  protected buildFilters(request: KnowledgeRetrievalRequest): Record<string, unknown> {
    return {
      ...(request.userId ? { userId: request.userId } : {}),
      ...(request.moduleId ? { moduleId: request.moduleId } : {}),
    };
  }

  protected usesRecency(): boolean {
    return true;
  }
}
