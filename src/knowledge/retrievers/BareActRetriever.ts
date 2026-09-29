import type { KnowledgeRetrievalRequest } from '../types';
import { BaseRetriever } from './BaseRetriever';

export class BareActRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'BareActRetriever', kinds: ['bare_act_component'], mode: 'hybrid', limit: 6, tokenBudget: 1600 });
  }

  protected buildFilters(request: KnowledgeRetrievalRequest): Record<string, unknown> {
    const filters = super.buildFilters(request);
    if (request.componentTypes?.length === 1) {
      filters.componentType = request.componentTypes[0];
    }
    return filters;
  }
}
