import { CitationStyle, MemorialDepth, MemorialSide } from './memorial.types';
import { MemorialWorkflowService } from './memorial-workflow.service';
interface MemorialWorkflowBody {
    propositionText?: string;
    side?: MemorialSide;
    sourceName?: string;
    depth?: MemorialDepth;
    citationStyle?: CitationStyle;
    preferredModel?: string;
    selectedSources?: string | string[];
    competitionRulesText?: string;
    maxPages?: string | number;
    maxWords?: string | number;
    qualityThreshold?: string | number;
    allowUnverifiedAuthorities?: string | boolean;
    userId?: string;
}
export declare class MemorialWorkflowController {
    private readonly workflow;
    constructor(workflow: MemorialWorkflowService);
    blueprint(req: any, files: {
        file?: any[];
        references?: any[];
    }, body: MemorialWorkflowBody): Promise<{
        dossier: import("./memorial.types").CaseDossier;
        blueprint: import("./memorial.types").PropositionBlueprint;
        graph: import("./memorial.types").CaseGraph;
        references: import("./memorial.types").MemorialReferenceAnalysis[];
        audit: import("./memorial.types").MemorialWorkflowAudit;
    }>;
    run(req: any, files: {
        file?: any[];
        references?: any[];
    }, body: MemorialWorkflowBody): Promise<import("./memorial.types").MemorialWorkflowResult>;
    private toInput;
    private parseStringArray;
    private parseOptionalNumber;
}
export {};
