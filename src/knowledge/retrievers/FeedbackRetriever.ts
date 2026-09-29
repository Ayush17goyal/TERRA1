import type { KnowledgeRetrievalRequest } from '../types';
import { BaseRetriever } from './BaseRetriever';

export class FeedbackRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'FeedbackRetriever', kinds: ['previous_feedback'], mode: 'hybrid', limit: 5, tokenBudget: 1000 });
  }

  protected buildFilters(request: KnowledgeRetrievalRequest): Record<string, unknown> {
    return {
      ...(request.userId ? { userId: request.userId } : {}),
      ...(request.projectId ? { projectId: request.projectId } : {}),
      ...(request.draftId ? { draftId: request.draftId } : {}),
      ...(request.lessonId ? { lessonId: request.lessonId } : {}),
    };
  }

  protected usesRecency(): boolean {
    return true;
  }
}
