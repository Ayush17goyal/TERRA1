import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { type AppLogger } from '../logging/logger';
export declare class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger;
    constructor(logger: AppLogger);
    catch(exception: unknown, host: ArgumentsHost): void;
}
