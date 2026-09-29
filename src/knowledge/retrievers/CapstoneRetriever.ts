import type { KnowledgeRetrievalRequest } from '../types';
import { BaseRetriever } from './BaseRetriever';

export class CapstoneRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'CapstoneRetriever', kinds: ['capstone_project'], mode: 'hybrid', limit: 8, tokenBudget: 2200 });
  }

  protected buildFilters(request: KnowledgeRetrievalRequest): Record<string, unknown> {
    return {
      ...(request.userId ? { userId: request.userId } : {}),
      ...(request.projectId ? { projectId: request.projectId } : {}),
    };
  }
}
