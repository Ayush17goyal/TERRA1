export type PipelineStageName = 'extraction' | 'structural' | 'govtVerification' | 'legalSearch' | 'gptReasoning' | 'mergeResults' | 'auditReport';
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
export type CompletionStatus = 'running' | 'complete' | 'complete_with_warnings' | 'failed';
export type AuditStage = 'structural' | 'clause' | 'draftQuality' | 'crossReference' | 'compliance' | 'govtVerification' | 'legalSearch' | 'gptReasoning';
export type StageStatus = 'pending' | 'running' | 'passed' | 'warned' | 'failed' | 'error' | 'timeout';
export interface StageResult {
    status: StageStatus;
    findingCount: number;
    message: string;
    completedAt?: number;
}
export interface JobProgress {
    completionStatus: CompletionStatus;
    pipelineStages: Record<PipelineStageName, PipelineStage>;
    auditScore: number | null;
    hasTimeouts: boolean;
    scoreReady: boolean;
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
    stages: Record<AuditStage, StageResult>;
}
export declare class ProgressService {
    private readonly logger;
    private readonly jobs;
    init(draftId: string): void;
    update(draftId: string, patch: Partial<JobProgress>): void;
    startPipelineStage(draftId: string, stage: PipelineStageName, message?: string): void;
    finishPipelineStage(draftId: string, stage: PipelineStageName, state: 'success' | 'failed' | 'timeout', message: string, findingCount?: number): void;
    setCompletionStatus(draftId: string, status: CompletionStatus, message?: string): void;
    setAuditScore(draftId: string, score: number): void;
    updateStage(draftId: string, stage: AuditStage, result: Partial<StageResult>): void;
    get(draftId: string): JobProgress | null;
    evict(draftId: string): void;
    private recomputeScoreReady;
    private sweep;
}
