import type { KnowledgeRetrievalRequest } from '../types';
import { BaseRetriever } from './BaseRetriever';

export class PatternRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'PatternRetriever', kinds: ['pattern'], mode: 'hybrid', limit: 6, tokenBudget: 1400 });
  }

  protected buildFilters(request: KnowledgeRetrievalRequest): Record<string, unknown> {
    const filters = super.buildFilters(request);
    if (request.patternNames?.length === 1) {
      filters.patternName = request.patternNames[0];
    }
    return filters;
  }
}
