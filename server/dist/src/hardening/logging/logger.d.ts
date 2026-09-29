import pino from 'pino';
import type { RuntimeEnvironment } from '../config/environment';
export declare function createLogger(env: RuntimeEnvironment): pino.Logger<never, boolean>;
export type AppLogger = ReturnType<typeof createLogger>;
export declare function errorToLog(error: unknown): {
    name: string;
    message: string;
    stack: string;
} | {
    message: string;
    name?: undefined;
    stack?: undefined;
};
