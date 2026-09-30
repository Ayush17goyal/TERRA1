import { ArgumentBlock, MemorialQualityScore, MemorialSectionSet, MemorialWorkflowOptions, PropositionBlueprint, ResearchAuthority } from './memorial.types';
import { MemorialAiService } from './memorial-ai.service';
export declare class MemorialJudgeService {
    private readonly ai;
    private readonly logger;
    constructor(ai: MemorialAiService);
    score(sections: MemorialSectionSet, args: ArgumentBlock[], authorities: ResearchAuthority[], blueprint: PropositionBlueprint, options: MemorialWorkflowOptions): Promise<MemorialQualityScore>;
    private deterministic;
    private isValidCitation;
    private repetitionRatio;
    private jaccard;
    private stringArray;
    private clamp;
}
