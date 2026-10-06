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
    private prioritizedExplicitIssues;
    private fallback;
    private fallbackIssue;
    private subIssuesFor;
    private testsFor;
    private anchorsFor;
    private queriesFor;
    private pickFacts;
    private bestRawIssue;
    private isCompatibleStructure;
    private isInvestmentArbitration;
    private partyLabel;
    private totalWordBudget;
    private cleanArray;
    private cleanPosition;
    private normalizeIssue;
    private dedupe;
    private dedupeStrings;
    private corpus;
    private relevantBurden;
    private tokenOverlap;
    private tokens;
    private normalizedKey;
    private titleCase;
}
