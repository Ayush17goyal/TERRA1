import { BaseRetriever } from './BaseRetriever';

export class BehaviourRuleRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'BehaviourRuleRetriever', kinds: ['behaviour_rule'], mode: 'hybrid', limit: 4, tokenBudget: 800 });
  }
}
