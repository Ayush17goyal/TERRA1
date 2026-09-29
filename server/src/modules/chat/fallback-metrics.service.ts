import { Injectable } from '@nestjs/common';

@Injectable()
export class FallbackMetricsService {
  private metrics = {
    totalRequests: 0,
    level1Hits: 0, // Gemini Flash
    level2Hits: 0, // GPT-4o Mini
    level3Hits: 0, // DeepSeek R1
    level4Hits: 0, // Semantic Cache
    level5Hits: 0, // Qdrant Retrieval Only
    level6Hits: 0, // Friendly User Response
  };

  private failuresByModel: Record<string, number> = {};

  incrementRequest() {
    this.metrics.totalRequests++;
  }

  incrementHit(level: 1 | 2 | 3 | 4 | 5 | 6) {
    const key = `level${level}Hits` as keyof typeof this.metrics;
    this.metrics[key]++;
  }

  recordFailure(model: string) {
    this.failuresByModel[model] = (this.failuresByModel[model] || 0) + 1;
  }

  getMetrics() {
    return {
      ...this.metrics,
      failuresByModel: this.failuresByModel,
    };
  }
}
