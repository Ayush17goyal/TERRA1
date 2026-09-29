export type CircuitState = 'closed' | 'open' | 'half_open';
export declare class CircuitBreaker {
    private readonly name;
    private readonly failureThreshold;
    private readonly cooldownMs;
    private failures;
    private openedAt;
    private stateValue;
    constructor(name: string, failureThreshold?: number, cooldownMs?: number);
    get state(): CircuitState;
    execute<T>(operation: () => Promise<T>): Promise<T>;
}
export declare function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T>;
export declare function retryWithBackoff<T>(operation: () => Promise<T>, attempts?: number, baseDelayMs?: number): Promise<T>;
