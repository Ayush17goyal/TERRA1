import type { PromptBudgetManagerContract } from '../interfaces';
import type { PromptModuleFragment, PromptPriority } from '../types';
import { PromptCompressor } from './PromptCompressor';

const priorityRank: Record<PromptPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export class PromptBudgetManager implements PromptBudgetManagerContract {
  private readonly compressor: PromptCompressor;

  constructor(compressor = new PromptCompressor()) {
    this.compressor = compressor;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  enforceBudget(
    fragments: PromptModuleFragment[],
    totalBudget: number
  ): { fragments: PromptModuleFragment[]; estimatedTokens: number; warnings: string[] } {
    const warnings: string[] = [];
    let next = fragments.map((fragment) => {
      const estimated = this.estimateTokens(fragment.instructions);
      if (estimated <= fragment.tokenBudget.max) {
        return fragment;
      }

      warnings.push(`${fragment.moduleName} exceeded module budget and was compressed.`);
      return this.compressor.compressFragment(fragment, fragment.tokenBudget.max);
    });

    let estimatedTokens = this.estimateTokens(next.map((fragment) => fragment.instructions).join('\n\n'));

    if (estimatedTokens <= totalBudget) {
      return { fragments: next, estimatedTokens, warnings };
    }

    const compressible = [...next]
      .filter((fragment) => fragment.priority !== 'critical')
      .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);

    for (const fragment of compressible) {
      const index = next.findIndex((candidate) => candidate.moduleName === fragment.moduleName);
      next[index] = this.compressor.compressFragment(fragment, Math.max(120, fragment.tokenBudget.target));
      estimatedTokens = this.estimateTokens(next.map((candidate) => candidate.instructions).join('\n\n'));
      warnings.push(`${fragment.moduleName} compressed during total budget enforcement.`);

      if (estimatedTokens <= totalBudget) {
        break;
      }
    }

    return { fragments: next, estimatedTokens, warnings };
  }
}


