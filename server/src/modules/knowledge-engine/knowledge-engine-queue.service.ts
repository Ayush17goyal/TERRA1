import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeEngineService } from './knowledge-engine.service';

@Injectable()
export class KnowledgeEngineQueueService {
  private readonly logger = new Logger(KnowledgeEngineQueueService.name);
  private readonly maxConcurrent = Number(process.env.KNOWLEDGE_ENGINE_MAX_CONCURRENT_JOBS || 2);
  private active = 0;
  private readonly pending: string[] = [];
  private readonly queued = new Set<string>();

  constructor(private readonly knowledgeEngine: KnowledgeEngineService) {}

  enqueue(documentId: string): void {
    if (this.queued.has(documentId)) return;
    this.queued.add(documentId);
    this.pending.push(documentId);
    this.drain();
  }

  private drain(): void {
    while (this.active < this.maxConcurrent && this.pending.length > 0) {
      const documentId = this.pending.shift()!;
      this.active++;
      setImmediate(async () => {
        try {
          await this.knowledgeEngine.buildFromDocument(documentId);
        } catch (error: any) {
          this.logger.error(`Unhandled knowledge job error for ${documentId}: ${error.message}`, error.stack);
        } finally {
          this.queued.delete(documentId);
          this.active--;
          this.drain();
        }
      });
    }
  }
}
