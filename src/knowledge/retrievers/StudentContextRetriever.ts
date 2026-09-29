import type { KnowledgeRetrievalRequest } from '../types';
import { BaseRetriever } from './BaseRetriever';

export class StudentContextRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'StudentContextRetriever', kinds: ['student_state'], mode: 'keyword', limit: 3, tokenBudget: 700 });
  }

  protected buildFilters(request: KnowledgeRetrievalRequest): Record<string, unknown> {
    return {
      ...(request.userId ? { userId: request.userId } : {}),
      ...(request.courseId ? { courseId: request.courseId } : {}),
    };
  }
}
