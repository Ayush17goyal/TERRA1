import type { AssembledPrompt } from '../../ai/prompts/types';

export class PromptVersionManager {
  private readonly baseVersion: string;

  constructor(baseVersion = 'bare-act-mentor-prompt-v1') {
    this.baseVersion = baseVersion;
  }

  getVersion(prompt: AssembledPrompt): string {
    const moduleSignature = prompt.fragments
      .map((fragment) => `${fragment.moduleName}:${fragment.priority}:${fragment.compressionSummary ?? 'full'}`)
      .join('|');
    return `${this.baseVersion}:${this.hash(moduleSignature)}`;
  }

  private hash(text: string): string {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }
}
