"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ProgressService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressService = void 0;
const common_1 = require("@nestjs/common");
const PIPELINE_STAGE_LABELS = {
    extraction: 'Extracting document',
    structural: 'Structural Validation',
    govtVerification: 'Government Verification',
    legalSearch: 'Verified Legal Search',
    gptReasoning: 'GPT Analysis',
    mergeResults: 'Generating Audit',
    auditReport: 'Generating Annotated PDF',
};
function makeInitialPipelineStages() {
    const stages = {};
    for (const [key, label] of Object.entries(PIPELINE_STAGE_LABELS)) {
        stages[key] = { label, state: 'waiting', message: 'Waiting…' };
    }
    return stages;
}
const INITIAL_AUDIT_STAGES = {
    structural: { status: 'pending', findingCount: 0, message: 'Awaiting structural check…' },
    clause: { status: 'pending', findingCount: 0, message: 'Awaiting clause review…' },
    draftQuality: { status: 'pending', findingCount: 0, message: 'Awaiting draft quality check…' },
    crossReference: { status: 'pending', findingCount: 0, message: 'Awaiting cross-reference scan…' },
    compliance: { status: 'pending', findingCount: 0, message: 'Awaiting compliance check…' },
    govtVerification: { status: 'pending', findingCount: 0, message: 'Awaiting government source verification…' },
    legalSearch: { status: 'pending', findingCount: 0, message: 'Awaiting verified legal search…' },
    gptReasoning: { status: 'pending', findingCount: 0, message: 'Awaiting GPT legal reasoning…' },
};
const JOB_TTL_MS = 30 * 60 * 1_000;
let ProgressService = ProgressService_1 = class ProgressService {
    constructor() {
        this.logger = new common_1.Logger(ProgressService_1.name);
        this.jobs = new Map();
    }
    init(draftId) {
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
    update(draftId, patch) {
        const entry = this.jobs.get(draftId);
        if (!entry)
            return;
        if (patch.stages) {
            Object.assign(entry.progress.stages, patch.stages);
            const rest = { ...patch };
            delete rest.stages;
            Object.assign(entry.progress, rest);
        }
        else {
            Object.assign(entry.progress, patch);
        }
        this.recomputeScoreReady(entry.progress);
        entry.expiresAt = Date.now() + JOB_TTL_MS;
    }
    startPipelineStage(draftId, stage, message) {
        const entry = this.jobs.get(draftId);
        if (!entry)
            return;
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
    finishPipelineStage(draftId, stage, state, message, findingCount) {
        const entry = this.jobs.get(draftId);
        if (!entry)
            return;
        const s = entry.progress.pipelineStages[stage];
        const now = Date.now();
        s.state = state;
        s.completedAt = now;
        s.durationMs = s.startedAt ? now - s.startedAt : undefined;
        s.message = message;
        if (findingCount !== undefined)
            s.findingCount = findingCount;
        const durStr = s.durationMs != null ? `${(s.durationMs / 1000).toFixed(1)} sec` : '—';
        const icon = state === 'success' ? '✓' : state === 'timeout' ? '✗ TIMEOUT' : '✗';
        this.logger.log(`[${draftId}] ${icon} Stage "${stage}" ${state.toUpperCase()} — ${durStr}`);
        if (state === 'timeout')
            entry.progress.hasTimeouts = true;
        entry.expiresAt = now + JOB_TTL_MS;
    }
    setCompletionStatus(draftId, status, message) {
        const entry = this.jobs.get(draftId);
        if (!entry)
            return;
        entry.progress.completionStatus = status;
        if (message)
            entry.progress.message = message;
        if (status !== 'running') {
            entry.progress.completedAt = Date.now();
            entry.progress.phase =
                status === 'failed' ? 'error'
                    : status === 'complete' || status === 'complete_with_warnings' ? 'done'
                        : 'reviewing';
            if (status === 'complete' || status === 'complete_with_warnings') {
                for (const key of Object.keys(entry.progress.stages)) {
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
    setAuditScore(draftId, score) {
        const entry = this.jobs.get(draftId);
        if (!entry)
            return;
        entry.progress.auditScore = score;
        entry.expiresAt = Date.now() + JOB_TTL_MS;
    }
    updateStage(draftId, stage, result) {
        const entry = this.jobs.get(draftId);
        if (!entry)
            return;
        Object.assign(entry.progress.stages[stage], result);
        this.recomputeScoreReady(entry.progress);
        entry.expiresAt = Date.now() + JOB_TTL_MS;
    }
    get(draftId) {
        const entry = this.jobs.get(draftId);
        if (!entry)
            return null;
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
    evict(draftId) {
        this.jobs.delete(draftId);
    }
    recomputeScoreReady(p) {
        const allDone = Object.values(p.stages)
            .every(s => s.status !== 'pending' && s.status !== 'running');
        p.scoreReady = allDone;
    }
    sweep() {
        const now = Date.now();
        for (const [id, entry] of this.jobs) {
            if (now > entry.expiresAt) {
                this.jobs.delete(id);
                this.logger.debug(`Evicted stale job progress for ${id}`);
            }
        }
    }
};
exports.ProgressService = ProgressService;
exports.ProgressService = ProgressService = ProgressService_1 = __decorate([
    (0, common_1.Injectable)()
], ProgressService);
//# sourceMappingURL=progress.service.js.map