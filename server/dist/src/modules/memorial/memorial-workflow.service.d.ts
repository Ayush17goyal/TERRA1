import { MemorialReferenceAnalysis, MemorialWorkflowAudit, MemorialWorkflowOptions, MemorialWorkflowResult } from './memorial.types';
import { PropositionPreservationService } from './proposition-preservation.service';
import { PropositionIntelligenceService } from './proposition-intelligence.service';
import { CaseGraphService } from './case-graph.service';
import { IssueEngineService } from './issue-engine.service';
import { AuthorityEngineService } from './authority-engine.service';
import { ArgumentEngineService } from './argument-engine.service';
import { MemorialCompilerService } from './memorial-compiler.service';
import { MemorialJudgeService } from './memorial-judge.service';
interface RunInput extends MemorialWorkflowOptions {
    file?: any;
    referenceFiles?: any[];
    propositionText?: string;
    sourceName?: string;
}
export declare class MemorialWorkflowService {
    private readonly preservation;
    private readonly propositionIntelligence;
    private readonly graphService;
    private readonly issueEngine;
    private readonly authorityEngine;
    private readonly argumentEngine;
    private readonly compiler;
    private readonly judge;
    private readonly logger;
    private readonly referenceCache;
    constructor(preservation: PropositionPreservationService, propositionIntelligence: PropositionIntelligenceService, graphService: CaseGraphService, issueEngine: IssueEngineService, authorityEngine: AuthorityEngineService, argumentEngine: ArgumentEngineService, compiler: MemorialCompilerService, judge: MemorialJudgeService);
    run(input: RunInput): Promise<MemorialWorkflowResult>;
    extractBlueprint(input: RunInput): Promise<{
        dossier: import("./memorial.types").CaseDossier;
        blueprint: import("./memorial.types").PropositionBlueprint;
        graph: import("./memorial.types").CaseGraph;
        references: MemorialReferenceAnalysis[];
        audit: MemorialWorkflowAudit;
    }>;
    private analyzeReferences;
    private analyzeReference;
    private applyReferenceRules;
    private generateSide;
    private normalizeOptions;
    private assertBlueprintIsUsable;
    private stage;
    private title;
    private clamp;
}
export {};
