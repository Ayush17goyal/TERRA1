export declare class PromptInjectionGate {
    sanitizeForPrompt(text: string): string;
    validateClassifierOutput<T extends {
        confidence?: number;
    }>(output: T, allowedValues: string[], valueField: keyof T): boolean;
}
