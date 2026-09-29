import { BaseRetriever } from './BaseRetriever';

export class AssessmentRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'AssessmentRetriever', kinds: ['assessment_rule'], mode: 'hybrid', limit: 5, tokenBudget: 1000 });
  }
}
