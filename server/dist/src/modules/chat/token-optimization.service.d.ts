export declare class TokenOptimizationService {
    private stats;
    calculateMaxTokens(moduleName: 'lexmentor' | 'research' | 'judgment' | 'notebook', options: {
        userMode?: string;
        query?: string;
        contextSize?: number;
    }): number;
    logUsage(moduleName: 'lexmentor' | 'research' | 'judgment' | 'notebook', promptTokens: number, completionTokens: number): void;
    getAverageUsage(moduleName: 'lexmentor' | 'research' | 'judgment' | 'notebook'): number;
    getAnalytics(): {
        lexmentor: {
            totalRequests: number;
            totalPromptTokens: number;
            totalCompletionTokens: number;
            averageCompletionTokens: number;
        };
        research: {
            totalRequests: number;
            totalPromptTokens: number;
            totalCompletionTokens: number;
            averageCompletionTokens: number;
        };
        judgment: {
            totalRequests: number;
            totalPromptTokens: number;
            totalCompletionTokens: number;
            averageCompletionTokens: number;
        };
        notebook: {
            totalRequests: number;
            totalPromptTokens: number;
            totalCompletionTokens: number;
            averageCompletionTokens: number;
        };
    };
}
