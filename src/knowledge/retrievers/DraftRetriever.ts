import type { KnowledgeRetrievalRequest } from '../types';
import { BaseRetriever } from './BaseRetriever';

export class DraftRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'DraftRetriever', kinds: ['draft_history'], mode: 'hybrid', limit: 5, tokenBudget: 1200 });
  }

  protected buildFilters(request: KnowledgeRetrievalRequest): Record<string, unknown> {
    return {
      ...(request.userId ? { userId: request.userId } : {}),
      ...(request.projectId ? { projectId: request.projectId } : {}),
      ...(request.draftId ? { draftId: request.draftId } : {}),
    };
  }

  protected usesRecency(): boolean {
    return true;
  }
}
