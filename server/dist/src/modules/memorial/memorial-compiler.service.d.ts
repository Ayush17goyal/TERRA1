import { ArgumentBlock, CaseGraph, IssueMatrixItem, MemorialRenderModel, MemorialSectionSet, MemorialSide, PropositionBlueprint, ResearchAuthority } from './memorial.types';
export declare class MemorialCompilerService {
    compile(side: Exclude<MemorialSide, 'both'>, blueprint: PropositionBlueprint, graph: CaseGraph, issues: IssueMatrixItem[], authorities: ResearchAuthority[], args: ArgumentBlock[]): {
        sections: MemorialSectionSet;
        renderModel: MemorialRenderModel;
        markdown: string;
    };
    private cover;
    private toc;
    private jurisdictionParagraphs;
    private factParagraphs;
    private composeFactParagraph;
    private qualifyFact;
    private summaryRows;
    private subArgumentParagraphs;
    private prayerParagraphs;
    private abbreviationRows;
    private authorityGroups;
    private bestProceduralFacts;
    private usedAuthorities;
    private validAuthority;
    private renderMarkdown;
    private isUsableFact;
    private isJunk;
    private proceduralOrder;
    private cleanFact;
    private dedupeFacts;
    private dedupeAuthorities;
    private dedupeText;
    private ensurePeriod;
    private ensureSemicolon;
    private lowerFirst;
    private short;
    private roman;
}
