import { Repository } from 'typeorm';
import { PipelineAnalyticRecord } from './conversation.entities';
import { PipelineContext } from './pipeline.types';
export declare class PipelineAnalyticsService {
    private readonly analyticsRepo;
    private readonly logger;
    constructor(analyticsRepo: Repository<PipelineAnalyticRecord>);
    record(ctx: PipelineContext): void;
    private writeAsync;
}
