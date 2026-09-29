import { DefinitionEntry, ExamConstruct, IllustrationEntry, SectionNode } from '../types/document-graph.types';
export declare class IllustrationExtractionStage {
    extract(section: SectionNode, definitionsInSection: DefinitionEntry[], constructsInSection: ExamConstruct[]): IllustrationEntry[];
}
