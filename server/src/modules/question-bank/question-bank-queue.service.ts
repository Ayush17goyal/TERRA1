import { Injectable, Logger, Optional } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service';
import { ModelAnswerQueueService } from '../model-answer/model-answer-queue.service';

// Same in-memory concurrency-bounded/dedup queue pattern as
// server/src/modules/knowledge-engine/knowledge-engine-queue.service.ts, keyed by userId —
// architecture.md §7.1 Step 5 ("Storage & Indexing") is the natural trigger point for Module 5
// (Model Answer Engine) to pick up newly created QuestionBankEntry rows.
@Injectable()
export class QuestionBankQueueService {
  private readonly logger = new Logger(QuestionBankQueueService.name);
  private readonly maxConcurrent = Number(process.env.QUESTION_BANK_MAX_CONCURRENT_JOBS || 2);
  private active = 0;
  private readonly pending: string[] = [];
  private readonly queued = new Set<string>();

  constructor(
    private readonly questionBank: QuestionBankService,
    @Optional() private readonly modelAnswerQueue?: ModelAnswerQueueService,
  ) {}

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
          const summary = await this.questionBank.createQuestionBank(userId);
          if (summary.valid > 0) {
            this.modelAnswerQueue?.enqueue(userId);
          }
        } catch (error: any) {
          this.logger.error(`Unhandled question-bank job error for user ${userId}: ${error.message}`, error.stack);
        } finally {
          this.queued.delete(userId);
          this.active--;
          this.drain();
        }
      });
    }
  }
}
