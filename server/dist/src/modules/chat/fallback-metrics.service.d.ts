export declare class FallbackMetricsService {
    private metrics;
    private failuresByModel;
    incrementRequest(): void;
    incrementHit(level: 1 | 2 | 3 | 4 | 5 | 6): void;
    recordFailure(model: string): void;
    getMetrics(): {
        failuresByModel: Record<string, number>;
        totalRequests: number;
        level1Hits: number;
        level2Hits: number;
        level3Hits: number;
        level4Hits: number;
        level5Hits: number;
        level6Hits: number;
    };
}
