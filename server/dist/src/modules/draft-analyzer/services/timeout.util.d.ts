export declare class TimeoutError extends Error {
    readonly stage: string;
    readonly limitMs: number;
    constructor(stage: string, limitMs: number);
}
export declare function withTimeout<T>(promise: Promise<T>, ms: number, stage: string): Promise<T>;
