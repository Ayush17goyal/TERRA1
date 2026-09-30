import { CaseGraph, IssueMatrixItem, MemorialWorkflowOptions, PropositionBlueprint } from './memorial.types';
import { MemorialAiService } from './memorial-ai.service';
export declare class IssueEngineService {
    private readonly ai;
    private readonly logger;
    constructor(ai: MemorialAiService);
    generate(graph: CaseGraph, blueprint: PropositionBlueprint, options: MemorialWorkflowOptions): Promise<{
        issues: IssueMatrixItem[];
        usedAi: boolean;
        warning?: string;
    }>;
    private compactBlueprint;
    private normalize;
    private fallback;
    private fallbackIssue;
    private pickFacts;
    private isCompatibleStructure;
    private totalWordBudget;
    private compactIssueFactIds;
    private cleanArray;
    private cleanPosition;
    private normalizeIssue;
    private dedupe;
    private corpus;
    private relevantBurden;
    private anchorsFor;
    private queriesFor;
}
