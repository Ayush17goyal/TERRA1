import { VectorSearchService } from '../retrieval/vector-search.service';
import { IssueMatrixItem, MemorialWorkflowOptions, PropositionBlueprint, ResearchAuthority } from './memorial.types';
import { MemorialAiService } from './memorial-ai.service';
export declare class AuthorityEngineService {
    private readonly ai;
    private readonly vectorSearch;
    private readonly logger;
    constructor(ai: MemorialAiService, vectorSearch: VectorSearchService);
    generate(issues: IssueMatrixItem[], blueprint: PropositionBlueprint, options: MemorialWorkflowOptions): Promise<{
        authorities: ResearchAuthority[];
        usedAi: boolean;
        warning?: string;
    }>;
    private buildCandidates;
    private retrieveCandidates;
    private normalizeRankings;
    private deterministicRank;
    private rankForIssue;
    private toAuthority;
    private dedupe;
    private isValidAuthorityCitation;
    private issueFamily;
    private familyCompatibility;
    private toCollection;
    private side;
    private isDuplicateCitation;
    private tokens;
    private overlap;
    private clamp;
}
