import { BaseRetriever } from './BaseRetriever';

export class PromptModuleRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'PromptModuleRetriever', kinds: ['prompt_module'], mode: 'keyword', limit: 4, tokenBudget: 700 });
  }
}
