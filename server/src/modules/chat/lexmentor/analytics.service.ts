/**
 * Stage 12 — Pipeline Analytics
 *
 * Records per-request telemetry asynchronously.
 * Every pipeline run emits a structured record containing:
 *   - Stage-level latencies
 *   - Token usage
 *   - Provider used
 *   - Retrieval stats
 *   - Intent classification
 *
 * Analytics writes are always fire-and-forget — they never slow down
 * the user-facing response. Failures here are logged but never thrown.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PipelineAnalyticRecord } from './conversation.entities';
import { PipelineContext } from './pipeline.types';

@Injectable()
export class PipelineAnalyticsService {
  private readonly logger = new Logger(PipelineAnalyticsService.name);

  constructor(
    @InjectRepository(PipelineAnalyticRecord)
    private readonly analyticsRepo: Repository<PipelineAnalyticRecord>,
  ) {}

  /** Fire-and-forget. Never awaited by the pipeline orchestrator. */
  record(ctx: PipelineContext): void {
    this.writeAsync(ctx).catch((err) => {
      this.logger.warn(`Analytics write failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  private async writeAsync(ctx: PipelineContext): Promise<void> {
    const pipelineTotalMs = Date.now() - ctx.startedAt;

    await this.analyticsRepo.save(
      this.analyticsRepo.create({
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        requestId: ctx.requestId,
        intent: ctx.intent,
        provider: ctx.reasoning?.provider ?? 'unknown',
        model: ctx.reasoning?.model ?? 'unknown',
        pipelineTotalMs,
        retrievedChunks: ctx.rawAuthorities?.length ?? 0,
        promptTokens: ctx.reasoning?.promptTokens ?? 0,
        completionTokens: ctx.reasoning?.completionTokens ?? 0,
        depth: ctx.depth,
        stageTimings: ctx.stageTimings ?? {},
      }),
    );
  }
}
