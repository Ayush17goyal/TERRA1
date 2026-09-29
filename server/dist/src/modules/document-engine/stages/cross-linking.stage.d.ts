import { CaseEntry, CitationEntry, DefinitionEntry, DocumentGraph, DocumentTree, ExamConstruct, IllustrationEntry, SectionNode, SubtopicTag, TopicTag } from '../types/document-graph.types';
export interface CrossLinkingInput {
    tree: DocumentTree;
    sections: SectionNode[];
    topicTags: Record<string, TopicTag[]>;
    subtopicTags: Record<string, SubtopicTag[]>;
    examConstructs: ExamConstruct[];
    definitions: DefinitionEntry[];
    illustrations: IllustrationEntry[];
    cases: CaseEntry[];
    citations: CitationEntry[];
}
export declare class CrossLinkingStage {
    link(input: CrossLinkingInput): DocumentGraph;
    private normalizeCaseName;
}
