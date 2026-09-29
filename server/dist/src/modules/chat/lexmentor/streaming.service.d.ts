import { Observable } from 'rxjs';
import { LexMentorResult } from '../lexmentor-ai.service';
export type SseEvent = {
    type: 'token';
    data: string;
} | {
    type: 'result';
    data: LexMentorResult;
} | {
    type: 'error';
    data: {
        code: string;
        message: string;
    };
} | {
    type: 'done';
};
export declare class StreamingService {
    private readonly logger;
    private readonly jobs;
    createJob(): string;
    getStream(jobId: string, lastEventId?: string): Observable<MessageEvent> | null;
    pushToken(jobId: string, token: string): void;
    finalize(jobId: string, result: LexMentorResult): void;
    pushError(jobId: string, code: string, message: string): void;
    private pushEvent;
    private closeJob;
}
