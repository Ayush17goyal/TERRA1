import type { KnowledgeContextItem, KnowledgeRetrievalResult, RetrievalCandidate } from '../types';

export class TokenBudgetManager {
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  select(candidates: RetrievalCandidate[], tokenBudget: number): Pick<KnowledgeRetrievalResult, 'items' | 'omitted' | 'usedTokens'> {
    const items: KnowledgeContextItem[] = [];
    const omitted: KnowledgeContextItem[] = [];
    let usedTokens = 0;

    for (const candidate of candidates) {
      const item = this.toContextItem(candidate);
      if (usedTokens + item.tokenEstimate <= tokenBudget) {
        items.push(item);
        usedTokens += item.tokenEstimate;
      } else {
        omitted.push(item);
      }
    }

    return { items, omitted, usedTokens };
  }

  private toContextItem(candidate: RetrievalCandidate): KnowledgeContextItem {
    return {
      id: candidate.document.id,
      kind: candidate.document.kind,
      title: candidate.document.title,
      content: candidate.document.content,
      metadata: candidate.document.metadata,
      score: candidate.finalScore,
      reasons: candidate.reasons,
      tokenEstimate: this.estimateTokens(candidate.document.content),
    };
  }
}
