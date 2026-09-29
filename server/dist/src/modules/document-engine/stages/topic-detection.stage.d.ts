import { ExamConstruct, SectionNode, SubtopicTag, TopicTag } from '../types/document-graph.types';
export declare class TopicDetectionStage {
    private readonly topicKeywords;
    constructor();
    classifyTopics(section: SectionNode): TopicTag[];
    classifySubtopics(section: SectionNode, topicTags: TopicTag[]): SubtopicTag[];
    detectConstructs(section: SectionNode): ExamConstruct[];
    private escape;
}
