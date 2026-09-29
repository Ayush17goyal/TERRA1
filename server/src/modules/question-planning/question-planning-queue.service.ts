import { Injectable, Logger, Optional } from '@nestjs/common';
import { QuestionPlanningService } from './question-planning.service';
import { QuestionBankQueueService } from '../question-bank/question-bank-queue.service';

// Mirrors KnowledgeEngineQueueService's in-memory, concurrency-bounded, dedup-by-key queue
// (server/src/modules/knowledge-engine/knowledge-engine-queue.service.ts) so the exam-engine
// pipeline uses one consistent background-processing mechanism end to end (architecture.md
// §12.1 "knowledge-aggregation" / "question-generation" queue segmentation).
//
// Keyed by userId rather than documentId: architecture.md §7's Question Generation Engine
// operates over the whole PersonalExamLibrary (coverage matrix across all of a user's TKUs),
// not a single document, so the natural incremental unit here is "recompute this user's plan",
// not "recompute this TKU's plan". Concurrent triggers for the same user collapse into a single
// rerun via the `queued` set, which keeps this cheap even if several documents finish knowledge
// processing back-to-back.
@Injectable()
export class QuestionPlanningQueueService {
  private readonly logger = new Logger(QuestionPlanningQueueService.name);
  private readonly maxConcurrent = Number(process.env.QUESTION_PLANNING_MAX_CONCURRENT_JOBS || 2);
  private active = 0;
  private readonly pending: string[] = [];
  private readonly queued = new Set<string>();

  constructor(
    private readonly questionPlanning: QuestionPlanningService,
    @Optional() private readonly questionBankQueue?: QuestionBankQueueService,
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
          const plan = await this.questionPlanning.buildPlan(userId);
          if (plan.status === 'ready' && plan.summary?.totalSlots > 0) {
            this.questionBankQueue?.enqueue(userId);
          }
        } catch (error: any) {
          this.logger.error(`Unhandled question-planning job error for user ${userId}: ${error.message}`, error.stack);
        } finally {
          this.queued.delete(userId);
          this.active--;
          this.drain();
        }
      });
    }
  }
}
