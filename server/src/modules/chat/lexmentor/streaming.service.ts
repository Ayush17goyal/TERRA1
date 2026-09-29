/**
 * Stage 10 — Streaming Service
 *
 * Manages active SSE connections for the LexMentor pipeline.
 *
 * Flow:
 *  1. Client calls POST /chat/message?stream=true
 *  2. ChatService calls StreamingService.createJob() → jobId
 *  3. Client opens GET /chat/stream/:jobId (SSE)
 *  4. Pipeline calls onToken() for each token → streamed to client
 *  5. Pipeline calls StreamingService.finalize() → pushes the full
 *     result object and closes the stream
 *
 * Reconnect resilience:
 *  Each job buffers the last 60 events for 90 seconds after completion,
 *  so a reconnecting client can replay missed tokens using Last-Event-ID.
 *
 * Jobs time out after 120 seconds to prevent memory leaks from
 * abandoned connections.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { LexMentorResult } from '../lexmentor-ai.service';

const JOB_TIMEOUT_MS = 120_000; // 2 minutes
const BUFFER_TTL_MS = 90_000; // replay buffer lifetime after completion

export type SseEvent =
  | { type: 'token'; data: string }
  | { type: 'result'; data: LexMentorResult }
  | { type: 'error'; data: { code: string; message: string } }
  | { type: 'done' };

interface StreamJob {
  subject: Subject<MessageEvent>;
  buffer: MessageEvent[];
  eventIndex: number;
  createdAt: number;
  completedAt?: number;
  timeoutHandle: NodeJS.Timeout;
}

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly jobs = new Map<string, StreamJob>();

  // ──────────────────────────────────────────────────────────────────────────
  // Job lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  /** Create a new streaming job. Returns the jobId. */
  createJob(): string {
    const jobId = `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const subject = new Subject<MessageEvent>();

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

  /** Get the Observable for a job (for the SSE controller endpoint). */
  getStream(jobId: string, lastEventId?: string): Observable<MessageEvent> | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    // Replay missed events if client reconnected with a Last-Event-ID
    if (lastEventId !== undefined && job.buffer.length) {
      const lastSeenIndex = parseInt(lastEventId, 10);
      if (!isNaN(lastSeenIndex)) {
        const missedEvents = job.buffer.filter(
          (_, idx) => idx > lastSeenIndex,
        );
        setTimeout(() => {
          for (const event of missedEvents) {
            job.subject.next(event);
          }
        }, 0);
      }
    }

    return job.subject.asObservable();
  }

  /** Called by the pipeline for each streaming token. */
  pushToken(jobId: string, token: string): void {
    this.pushEvent(jobId, { type: 'token', data: token });
  }

  /** Called by the pipeline when the full result is ready. */
  finalize(jobId: string, result: LexMentorResult): void {
    this.pushEvent(jobId, { type: 'result', data: result });
    this.pushEvent(jobId, { type: 'done' });
    const job = this.jobs.get(jobId);
    if (job) {
      clearTimeout(job.timeoutHandle);
      job.completedAt = Date.now();
      job.subject.complete();
      // Keep buffer for replay TTL, then clean up
      setTimeout(() => this.jobs.delete(jobId), BUFFER_TTL_MS);
    }
  }

  /** Called when the pipeline throws an error. */
  pushError(jobId: string, code: string, message: string): void {
    this.pushEvent(jobId, { type: 'error', data: { code, message } });
    this.closeJob(jobId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internals
  // ──────────────────────────────────────────────────────────────────────────

  private pushEvent(jobId: string, event: SseEvent): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const msgEvent = new MessageEvent(event.type, {
      data: JSON.stringify('data' in event ? event.data : {}),
      lastEventId: String(job.eventIndex++),
    });

    job.buffer.push(msgEvent);
    job.subject.next(msgEvent);
  }

  private closeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    clearTimeout(job.timeoutHandle);
    job.subject.complete();
    setTimeout(() => this.jobs.delete(jobId), BUFFER_TTL_MS);
  }
}
