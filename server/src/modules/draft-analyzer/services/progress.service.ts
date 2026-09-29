import { Injectable, Logger } from '@nestjs/common';

// ── Pipeline stage names (7 display stages shown in the frontend) ─────────────

export type PipelineStageName =
  | 'extraction'        // Stage 1 — PDF/DOCX text extraction
  | 'structural'        // Stage 2 — Rule-based structural + cross-ref validation
  | 'govtVerification'  // Stage 3A — Official government source verification (parallel)
  | 'legalSearch'       // Stage 3B — Verified legal search / case law (parallel)
  | 'gptReasoning'      // Stage 3C — GPT evidence-based legal reasoning (parallel)
  | 'mergeResults'      // Stage 4  — Dedup, merge, confidence weighting
  | 'auditReport';      // Stage 5  — Score calculation + report generation

export type StageState = 'waiting' | 'running' | 'success' | 'failed' | 'timeout';

export interface PipelineStage {
  label: string;
  state: StageState;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  findingCount?: number;
  message: string;
}

export type CompletionStatus =
  | 'running'
  | 'complete'
  | 'complete_with_warnings'   // one or more stages timed out but audit finished
  | 'failed';                  // extraction failed — no audit possible

// ── Legacy 8-stage audit-category tracking (used by AuditOverview panel) ──────

export type AuditStage =
  | 'structural'
  | 'clause'
  | 'draftQuality'
  | 'crossReference'
  | 'compliance'
  | 'govtVerification'
  | 'legalSearch'
  | 'gptReasoning';

export type StageStatus = 'pending' | 'running' | 'passed' | 'warned' | 'failed' | 'error' | 'timeout';

export interface StageResult {
  status: StageStatus;
  findingCount: number;
  message: string;
  completedAt?: number;
}

// ── Full job progress shape ────────────────────────────────────────────────────

export interface JobProgress {
  // ── New state machine ──────────────────────────────────────────────────────
  completionStatus: CompletionStatus;
  pipelineStages: Record<PipelineStageName, PipelineStage>;
  auditScore: number | null;    // backend-computed; null until Stage 5 runs
  hasTimeouts: boolean;         // true if any stage timed out
  scoreReady: boolean;          // true when all 8 audit stages have a terminal status

  // ── Legacy fields (polled by DraftAnalyzer.tsx) ────────────────────────────
  phase: 'extracting' | 'reviewing' | 'done' | 'error';
  extractPct: number;
  reviewPct: number;
  batchTotal: number;
  batchDone: number;
  batchFailed: number;
  batchRetried: number;
  message: string;
  error?: string;
  startedAt: number;
  completedAt?: number;

  // ── 8-stage audit tracking (polled by AuditOverview via audit-status) ─────
  stages: Record<AuditStage, StageResult>;
}

// ── Initial values ─────────────────────────────────────────────────────────────

const PIPELINE_STAGE_LABELS: Record<PipelineStageName, string> = {
  extraction:       'Extracting document',
  structural:       'Structural Validation',
  govtVerification: 'Government Verification',
  legalSearch:      'Verified Legal Search',
  gptReasoning:     'GPT Analysis',
  mergeResults:     'Generating Audit',
  auditReport:      'Generating Annotated PDF',
};

function makeInitialPipelineStages(): Record<PipelineStageName, PipelineStage> {
  const stages = {} as Record<PipelineStageName, PipelineStage>;
  for (const [key, label] of Object.entries(PIPELINE_STAGE_LABELS)) {
    stages[key as PipelineStageName] = { label, state: 'waiting', message: 'Waiting…' };
  }
  return stages;
}

const INITIAL_AUDIT_STAGES: Record<AuditStage, StageResult> = {
  structural:       { status: 'pending', findingCount: 0, message: 'Awaiting structural check…' },
  clause:           { status: 'pending', findingCount: 0, message: 'Awaiting clause review…' },
  draftQuality:     { status: 'pending', findingCount: 0, message: 'Awaiting draft quality check…' },
  crossReference:   { status: 'pending', findingCount: 0, message: 'Awaiting cross-reference scan…' },
  compliance:       { status: 'pending', findingCount: 0, message: 'Awaiting compliance check…' },
  govtVerification: { status: 'pending', findingCount: 0, message: 'Awaiting government source verification…' },
  legalSearch:      { status: 'pending', findingCount: 0, message: 'Awaiting verified legal search…' },
  gptReasoning:     { status: 'pending', findingCount: 0, message: 'Awaiting GPT legal reasoning…' },
};

// Keep completed/errored jobs in memory for 30 minutes
const JOB_TTL_MS = 30 * 60 * 1_000;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);
  private readonly jobs = new Map<string, { progress: JobProgress; expiresAt: number }>();

  init(draftId: string): void {
    this.jobs.set(draftId, {
      progress: {
        completionStatus: 'running',
        pipelineStages: makeInitialPipelineStages(),
        auditScore: null,
        hasTimeouts: false,
        scoreReady: false,

        phase: 'extracting',
        extractPct: 0,
        reviewPct: 0,
        batchTotal: 0,
        batchDone: 0,
        batchFailed: 0,
        batchRetried: 0,
        message: 'Starting extraction…',
        startedAt: Date.now(),

        stages: JSON.parse(JSON.stringify(INITIAL_AUDIT_STAGES)),
      },
      expiresAt: Date.now() + JOB_TTL_MS,
    });
    this.sweep();
  }

  // ── General patch update (legacy path) ────────────────────────────────────

  update(draftId: string, patch: Partial<JobProgress>): void {
    const entry = this.jobs.get(draftId);
    if (!entry) return;

    if (patch.stages) {
      Object.assign(entry.progress.stages, patch.stages);
      const rest = { ...patch };
      delete rest.stages;
      Object.assign(entry.progress, rest);
    } else {
      Object.assign(entry.progress, patch);
    }

    this.recomputeScoreReady(entry.progress);
    entry.expiresAt = Date.now() + JOB_TTL_MS;
  }

  // ── Pipeline stage updates ─────────────────────────────────────────────────

  startPipelineStage(draftId: string, stage: PipelineStageName, message?: string): void {
    const entry = this.jobs.get(draftId);
    if (!entry) return;
    const s = entry.progress.pipelineStages[stage];
    const now = Date.now();
    s.state = 'running';
    s.startedAt = now;
    s.completedAt = undefined;
    s.durationMs = undefined;
    s.message = message ?? `${s.label} running…`;
    entry.expiresAt = now + JOB_TTL_MS;
    this.logger.log(`[${draftId}] ▶ Stage "${stage}" RUNNING`);
  }

  finishPipelineStage(
    draftId: string,
    stage: PipelineStageName,
    state: 'success' | 'failed' | 'timeout',
    message: string,
    findingCount?: number,
  ): void {
    const entry = this.jobs.get(draftId);
    if (!entry) return;
    const s = entry.progress.pipelineStages[stage];
    const now = Date.now();
    s.state = state;
    s.completedAt = now;
    s.durationMs = s.startedAt ? now - s.startedAt : undefined;
    s.message = message;
    if (findingCount !== undefined) s.findingCount = findingCount;

    const durStr = s.durationMs != null ? `${(s.durationMs / 1000).toFixed(1)} sec` : '—';
    const icon = state === 'success' ? '✓' : state === 'timeout' ? '✗ TIMEOUT' : '✗';
    this.logger.log(`[${draftId}] ${icon} Stage "${stage}" ${state.toUpperCase()} — ${durStr}`);

    if (state === 'timeout') entry.progress.hasTimeouts = true;

    entry.expiresAt = now + JOB_TTL_MS;
  }

  setCompletionStatus(draftId: string, status: CompletionStatus, message?: string): void {
    const entry = this.jobs.get(draftId);
    if (!entry) return;
    entry.progress.completionStatus = status;
    if (message) entry.progress.message = message;
    if (status !== 'running') {
      entry.progress.completedAt = Date.now();
      entry.progress.phase =
        status === 'failed' ? 'error'
        : status === 'complete' || status === 'complete_with_warnings' ? 'done'
        : 'reviewing';

      // When the pipeline is complete (success or warnings), force ALL remaining
      // audit stages to a terminal state so scoreReady flips to true immediately.
      if (status === 'complete' || status === 'complete_with_warnings') {
        for (const key of Object.keys(entry.progress.stages) as AuditStage[]) {
          const s = entry.progress.stages[key];
          if (s.status === 'pending' || s.status === 'running') {
            s.status = 'passed';
            s.message = 'Completed';
            s.completedAt = Date.now();
          }
        }
        entry.progress.scoreReady = true;
      }
    }
    entry.expiresAt = Date.now() + JOB_TTL_MS;
    this.logger.log(`[${draftId}] Pipeline completionStatus → ${status} | scoreReady=${entry.progress.scoreReady}`);
  }

  setAuditScore(draftId: string, score: number): void {
    const entry = this.jobs.get(draftId);
    if (!entry) return;
    entry.progress.auditScore = score;
    entry.expiresAt = Date.now() + JOB_TTL_MS;
  }

  // ── Audit-stage updates (8-stage detail panel) ─────────────────────────────

  updateStage(draftId: string, stage: AuditStage, result: Partial<StageResult>): void {
    const entry = this.jobs.get(draftId);
    if (!entry) return;
    Object.assign(entry.progress.stages[stage], result);
    this.recomputeScoreReady(entry.progress);
    entry.expiresAt = Date.now() + JOB_TTL_MS;
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  get(draftId: string): JobProgress | null {
    const entry = this.jobs.get(draftId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.jobs.delete(draftId);
      return null;
    }
    return {
      ...entry.progress,
      pipelineStages: { ...entry.progress.pipelineStages },
      stages: { ...entry.progress.stages },
    };
  }

  evict(draftId: string): void {
    this.jobs.delete(draftId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private recomputeScoreReady(p: JobProgress): void {
    const allDone = Object.values(p.stages)
      .every(s => s.status !== 'pending' && s.status !== 'running');
    p.scoreReady = allDone;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, entry] of this.jobs) {
      if (now > entry.expiresAt) {
        this.jobs.delete(id);
        this.logger.debug(`Evicted stale job progress for ${id}`);
      }
    }
  }
}
