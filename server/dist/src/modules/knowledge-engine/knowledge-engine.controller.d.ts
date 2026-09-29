import { KnowledgeEngineService } from './knowledge-engine.service';
export declare class KnowledgeEngineController {
    private readonly knowledgeEngine;
    constructor(knowledgeEngine: KnowledgeEngineService);
    library(req: any): Promise<import("./entities/personal-exam-library.entity").PersonalExamLibraryEntity>;
    topics(req: any): Promise<import("./entities/topic-knowledge-unit.entity").TopicKnowledgeUnitEntity[]>;
    topic(id: string, req: any): Promise<import("./entities/topic-knowledge-unit.entity").TopicKnowledgeUnitEntity>;
    graph(req: any): Promise<{
        nodes: import("./entities/topic-knowledge-unit.entity").TopicKnowledgeUnitEntity[];
        edges: import("./entities/topic-graph-edge.entity").TopicGraphEdgeEntity[];
    }>;
}
