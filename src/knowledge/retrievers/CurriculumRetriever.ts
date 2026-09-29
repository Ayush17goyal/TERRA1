import { BaseRetriever } from './BaseRetriever';

export class CurriculumRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'CurriculumRetriever', kinds: ['curriculum'], mode: 'hybrid', limit: 4, tokenBudget: 1000 });
  }
}
