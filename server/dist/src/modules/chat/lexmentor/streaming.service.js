"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var StreamingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const JOB_TIMEOUT_MS = 120_000;
const BUFFER_TTL_MS = 90_000;
let StreamingService = StreamingService_1 = class StreamingService {
    constructor() {
        this.logger = new common_1.Logger(StreamingService_1.name);
        this.jobs = new Map();
    }
    createJob() {
        const jobId = `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const subject = new rxjs_1.Subject();
        const timeoutHandle = setTimeout(() => {
            this.pushEvent(jobId, {
                type: 'error',
                data: { code: 'PIPELINE_TIMEOUT', message: 'The request timed out. Please try again.' },
            });
            this.closeJob(jobId);
        }, JOB_TIMEOUT_MS);
        this.jobs.set(jobId, {
            subject,
            buffer: [],
            eventIndex: 0,
            createdAt: Date.now(),
            timeoutHandle,
        });
        this.logger.debug(`Stream job created: ${jobId}`);
        return jobId;
    }
    getStream(jobId, lastEventId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return null;
        if (lastEventId !== undefined && job.buffer.length) {
            const lastSeenIndex = parseInt(lastEventId, 10);
            if (!isNaN(lastSeenIndex)) {
                const missedEvents = job.buffer.filter((_, idx) => idx > lastSeenIndex);
                setTimeout(() => {
                    for (const event of missedEvents) {
                        job.subject.next(event);
                    }
                }, 0);
            }
        }
        return job.subject.asObservable();
    }
    pushToken(jobId, token) {
        this.pushEvent(jobId, { type: 'token', data: token });
    }
    finalize(jobId, result) {
        this.pushEvent(jobId, { type: 'result', data: result });
        this.pushEvent(jobId, { type: 'done' });
        const job = this.jobs.get(jobId);
        if (job) {
            clearTimeout(job.timeoutHandle);
            job.completedAt = Date.now();
            job.subject.complete();
            setTimeout(() => this.jobs.delete(jobId), BUFFER_TTL_MS);
        }
    }
    pushError(jobId, code, message) {
        this.pushEvent(jobId, { type: 'error', data: { code, message } });
        this.closeJob(jobId);
    }
    pushEvent(jobId, event) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
        const msgEvent = new MessageEvent(event.type, {
            data: JSON.stringify('data' in event ? event.data : {}),
            lastEventId: String(job.eventIndex++),
        });
        job.buffer.push(msgEvent);
        job.subject.next(msgEvent);
    }
    closeJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job)
            return;
        clearTimeout(job.timeoutHandle);
        job.subject.complete();
        setTimeout(() => this.jobs.delete(jobId), BUFFER_TTL_MS);
    }
};
exports.StreamingService = StreamingService;
exports.StreamingService = StreamingService = StreamingService_1 = __decorate([
    (0, common_1.Injectable)()
], StreamingService);
//# sourceMappingURL=streaming.service.js.map