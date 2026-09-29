import { AnalyticsEngineService } from './analytics-engine.service';
export declare class AnalyticsEngineController {
    private readonly analytics;
    constructor(analytics: AnalyticsEngineService);
    dashboard(req: any): Promise<import("./analytics-engine.types").AnalyticsDashboard>;
    topics(req: any): Promise<import("./analytics-engine.types").TopicPerformanceRow[]>;
    weakTopics(req: any): Promise<import("./analytics-engine.types").TopicPerformanceRow[]>;
    strongTopics(req: any): Promise<import("./analytics-engine.types").TopicPerformanceRow[]>;
    progress(req: any): Promise<{
        progressTracking: import("./analytics-engine.types").ProgressTracking;
        improvementGraph: import("./analytics-engine.types").ImprovementPoint[];
        timeAnalysis: import("./analytics-engine.types").TimeAnalysis;
    }>;
}
