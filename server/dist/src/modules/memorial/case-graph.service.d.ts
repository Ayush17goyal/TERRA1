import { CaseDossier, CaseGraph, PropositionBlueprint } from './memorial.types';
export declare class CaseGraphService {
    build(dossier: CaseDossier, blueprint: PropositionBlueprint): CaseGraph;
    private inferBurdens;
}
