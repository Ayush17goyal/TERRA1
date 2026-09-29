import type { RuntimeEnvironment } from '../config/environment';
import type { AppLogger } from '../logging/logger';
export declare function initializeSentry(env: RuntimeEnvironment, logger: AppLogger): void;
export declare function initializeOpenTelemetry(env: RuntimeEnvironment, logger: AppLogger): void;
export declare function shutdownTelemetry(logger: AppLogger): Promise<void>;
export declare function reportError(error: unknown, context?: Record<string, unknown>): void;
