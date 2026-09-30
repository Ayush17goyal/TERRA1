import { ArgumentBlock, CaseGraph, IssueMatrixItem, MemorialSide, MemorialWorkflowOptions, ResearchAuthority } from './memorial.types';
import { MemorialAiService } from './memorial-ai.service';
export declare class ArgumentEngineService {
    private readonly ai;
    private readonly logger;
    constructor(ai: MemorialAiService);
    build(side: Exclude<MemorialSide, 'both'>, issues: IssueMatrixItem[], authorities: ResearchAuthority[], graph: CaseGraph, options: MemorialWorkflowOptions): Promise<{
        arguments: ArgumentBlock[];
        usedAi: boolean;
        warning?: string;
    }>;
    private buildIssue;
    private buildPrompt;
    private normalizeIssue;
    private fallbackBlock;
    private fallbackSubArgument;
    private fallbackAnalysis;
    private fallbackRule;
    private fallbackClaim;
    private fallbackRebuttal;
    private defaultRebuttal;
    private issueFacts;
    private selectFactsForSubIssue;
    private selectAuthoritiesForSubIssue;
    private issueFamily;
    private familyRegex;
    private miniConclusion;
    private cleanHeading;
    private cleanProse;
    private dedupeSubArguments;
    private dedupeFacts;
    private tokens;
    private overlap;
    private lowerFirst;
    private countWords;
    private countBlockWords;
}
