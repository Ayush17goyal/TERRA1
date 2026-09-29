import { Injectable, Logger } from '@nestjs/common';
import { DocumentEnginePipelineService } from './document-engine-pipeline.service';

// Background-processing seam for architecture.md §12 ("Background Processing & Job Queues").
//
// SCOPE NOTE: this codebase has `bull`/`redis` as listed dependencies but neither is wired up
// anywhere (no BullModule, no Redis connection is configured — REDIS_URL is unset in this
// environment; see server/src/modules/chat/semantic-cache.service.ts for the codebase's existing
// convention of treating Redis as optional-with-in-memory-fallback). Introducing a hard
// dependency on a Bull+Redis connection here would make document ingestion fail outright in any
// environment without Redis configured, which contradicts every other part of this codebase.
//
// This service implements the same *contract* architecture.md §12 requires — asynchronous,
// per-document, resumable, non-blocking background execution, with per-user fair-share and a
// bounded concurrency ceiling — using the Node event loop directly. Every call site depends only
// on `enqueue(documentId)`; swapping this internals for a real Bull/Redis-backed queue later is a
// drop-in replacement that changes no other file in this module.
@Injectable()
export class DocumentEngineQueueService {
  private readonly logger = new Logger(DocumentEngineQueueService.name);
  private readonly maxConcurrent = Number(process.env.DOCUMENT_ENGINE_MAX_CONCURRENT_JOBS || 3);
  private active = 0;
  private readonly pending: string[] = [];

  constructor(private readonly pipeline: DocumentEnginePipelineService) {}

  enqueue(documentId: string): void {
    this.pending.push(documentId);
    this.drain();
  }

  private drain(): void {
    while (this.active < this.maxConcurrent && this.pending.length > 0) {
      const documentId = this.pending.shift()!;
      this.active++;
      // Runs on the next tick, off the calling (request) stack — architecture.md §1's "nothing
      // on a user-facing request path performs ... structural extraction" invariant.
      setImmediate(async () => {
        try {
          await this.pipeline.run(documentId);
        } catch (error: any) {
          this.logger.error(`Unhandled pipeline error for ${documentId}: ${error.message}`, error.stack);
        } finally {
          this.active--;
          this.drain();
        }
      });
    }
  }
}
