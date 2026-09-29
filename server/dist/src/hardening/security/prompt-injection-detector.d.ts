export interface PromptInjectionFinding {
    pattern: string;
    severity: 'warning' | 'error';
    index: number;
}
export declare function detectPromptInjection(input: string): PromptInjectionFinding[];
