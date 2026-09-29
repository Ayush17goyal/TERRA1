import { BaseRetriever } from './BaseRetriever';

export class TeachingRuleRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'TeachingRuleRetriever', kinds: ['teaching_rule'], mode: 'hybrid', limit: 4, tokenBudget: 800 });
  }
}
