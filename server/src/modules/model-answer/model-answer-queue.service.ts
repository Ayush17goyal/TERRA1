import { Injectable, Logger } from '@nestjs/common';
import { ModelAnswerService } from './model-answer.service';

// Same in-memory concurrency-bounded/dedup queue pattern as
// server/src/modules/knowledge-engine/knowledge-engine-queue.service.ts, keyed by userId. This is
// the terminal stage of the auto-chain: document-engine -> knowledge-engine -> question-planning
// -> question-bank -> model-answer. Model answers are generated once, at question-creation time
// (architecture.md §8, "generation happens once, at question-creation time, never at serving
// time"), so mock-test-engine never has to call an LLM on its request path.
@Injectable()
export class ModelAnswerQueueService {
  private readonly logger = new Logger(ModelAnswerQueueService.name);
  private readonly maxConcurrent = Number(process.env.MODEL_ANSWER_MAX_CONCURRENT_JOBS || 1);
  private active = 0;
  private readonly pending: string[] = [];
  private readonly queued = new Set<string>();

  constructor(private readonly modelAnswer: ModelAnswerService) {}

  enqueue(userId: string): void {
    if (this.queued.has(userId)) return;
    this.queued.add(userId);
    this.pending.push(userId);
    this.drain();
  }

  private drain(): void {
    while (this.active < this.maxConcurrent && this.pending.length > 0) {
      const userId = this.pending.shift()!;
      this.active++;
      setImmediate(async () => {
        try {
          await this.modelAnswer.createAnswerBank(userId);
        } catch (error: any) {
          this.logger.error(`Unhandled model-answer job error for user ${userId}: ${error.message}`, error.stack);
        } finally {
          this.queued.delete(userId);
          this.active--;
          this.drain();
        }
      });
    }
  }
}
