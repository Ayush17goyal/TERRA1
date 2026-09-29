import { BaseRetriever } from './BaseRetriever';

export class LessonRetriever extends BaseRetriever {
  constructor() {
    super({ name: 'LessonRetriever', kinds: ['lesson'], mode: 'hybrid', limit: 4, tokenBudget: 900 });
  }
}
