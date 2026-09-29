import { PromptAssemblyEngine } from '../../ai/prompts/assembler/PromptAssemblyEngine';
import type { AssembledPrompt } from '../../ai/prompts/types';
import type { RuntimeDecisionPacket } from '../types';
import { PromptCache } from '../cache/PromptCache';
import { PromptVersionManager } from './PromptVersionManager';

export class PromptExecutor {
  private readonly assemblyEngine: PromptAssemblyEngine;
  private readonly promptCache: PromptCache<AssembledPrompt>;
  private readonly versionManager: PromptVersionManager;

  constructor(options: {
    assemblyEngine?: PromptAssemblyEngine;
    promptCache?: PromptCache<AssembledPrompt>;
    versionManager?: PromptVersionManager;
  } = {}) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      const missing = [
        !options.assemblyEngine ? 'assemblyEngine' : '',
        !options.promptCache ? 'promptCache' : '',
        !options.versionManager ? 'versionManager' : '',
      ].filter(Boolean);
      if (missing.length) throw new Error(`PromptExecutor is not production-ready: missing required dependencies [${missing.join(', ')}].`);
    }
    this.assemblyEngine = options.assemblyEngine ?? new PromptAssemblyEngine();
    this.promptCache = options.promptCache ?? new PromptCache<AssembledPrompt>();
    this.versionManager = options.versionManager ?? new PromptVersionManager();
  }

  assemble(packet: RuntimeDecisionPacket): { prompt: AssembledPrompt; version: string; cacheHit: boolean } {
    const cacheAllowed = packet.cachePolicy?.allowPromptCache ?? true;
    const key = this.promptCache.key({
      promptRequest: packet.promptRequest,
      retrieval: packet.retrieval?.items.map((item) => item.id),
      intent: packet.intent,
      strategy: packet.teachingStrategy,
    });

    if (cacheAllowed) {
      const cached = this.promptCache.get(key);
      if (cached) {
        return { prompt: cached, version: this.versionManager.getVersion(cached), cacheHit: true };
      }
    }

    const prompt = this.assemblyEngine.assemble(packet.promptRequest);
    if (cacheAllowed) {
      this.promptCache.set(key, prompt, packet.cachePolicy?.ttlMs);
    }

    return { prompt, version: this.versionManager.getVersion(prompt), cacheHit: false };
  }
}
