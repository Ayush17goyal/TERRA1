import type { PromptModuleFragment, PromptPriority } from '../types';

const priorityRank: Record<PromptPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export class PromptCompressor {
  compressFragment(fragment: PromptModuleFragment, maxTokens: number): PromptModuleFragment {
    const maxChars = maxTokens * 4;

    if (fragment.instructions.length <= maxChars) {
      return fragment;
    }

    const protectedPrefix = fragment.priority === 'critical' ? 0.8 : 0.6;
    const clippedLength = Math.max(200, Math.floor(maxChars * protectedPrefix));
    const instructions = `${fragment.instructions.slice(0, clippedLength).trim()}\n[Compressed: lower-priority detail omitted.]`;

    return {
      ...fragment,
      instructions,
      compressionSummary: `Compressed ${fragment.moduleName} to fit ${maxTokens} token budget.`,
    };
  }

  sortForCompression(fragments: PromptModuleFragment[]): PromptModuleFragment[] {
    return [...fragments].sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);
  }
}
