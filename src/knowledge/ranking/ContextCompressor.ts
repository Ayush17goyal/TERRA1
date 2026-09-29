import type { KnowledgeContextItem } from '../types';

export class ContextCompressor {
  compress(items: KnowledgeContextItem[], maxTokensPerItem: number): KnowledgeContextItem[] {
    return items.map((item) => {
      if (item.tokenEstimate <= maxTokensPerItem) {
        return item;
      }

      const maxChars = maxTokensPerItem * 4;
      const heading = `${item.title}\n`;
      const remaining = Math.max(0, maxChars - heading.length - 80);
      const content = `${heading}${item.content.slice(0, remaining).trim()}\n[Compressed for retrieval budget.]`;

      return {
        ...item,
        content,
        tokenEstimate: Math.ceil(content.length / 4),
      };
    });
  }
}
