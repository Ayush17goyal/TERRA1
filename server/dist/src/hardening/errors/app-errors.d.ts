export declare class AppError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly safeMessage: string;
    readonly retryable: boolean;
    constructor(message: string, code: string, statusCode?: number, safeMessage?: string, retryable?: boolean);
}
export declare class DependencyUnavailableError extends AppError {
    constructor(dependency: string, message?: string);
}
export declare class SecurityPolicyError extends AppError {
    constructor(message: string, safeMessage?: string);
}
export declare class ConfigurationError extends AppError {
    constructor(message: string);
}
