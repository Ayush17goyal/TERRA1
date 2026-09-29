import type { LLMCost, LLMUsage } from '../types';

interface ModelPrice {
  inputPerMillion: number;
  outputPerMillion: number;
}

const defaultPrices: Record<string, ModelPrice> = {
  'gpt-4.1': { inputPerMillion: 2, outputPerMillion: 8 },
  'gpt-4.1-mini': { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  'gpt-4.1-nano': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  'gpt-5': { inputPerMillion: 1.25, outputPerMillion: 10 },
  'gpt-5-mini': { inputPerMillion: 0.25, outputPerMillion: 2 },
};

export class CostTracker {
  private readonly prices: Record<string, ModelPrice>;

  constructor(prices: Record<string, ModelPrice> = defaultPrices) {
    this.prices = prices;
  }

  calculate(model: string, usage: LLMUsage, completionLength: number): LLMCost {
    const price = this.prices[model] ?? this.prices['gpt-4.1-mini'];
    const inputCostUsd = usage.inputTokens * price.inputPerMillion / 1_000_000;
    const outputCostUsd = usage.outputTokens * price.outputPerMillion / 1_000_000;

    return {
      model,
      inputCostUsd,
      outputCostUsd,
      estimatedCostUsd: inputCostUsd + outputCostUsd,
      actualCostUsd: inputCostUsd + outputCostUsd,
      completionLength,
    };
  }
}
