import { SourceReference } from '../knowledge-engine.types';
export type TopicGraphRelation = 'parent_child' | 'related' | 'case_links' | 'provision_links' | 'example_links';
export declare class TopicGraphEdgeEntity {
    id: string;
    userId: string;
    sourceTkuId: string;
    targetTkuId: string;
    relation: TopicGraphRelation;
    strength: number;
    references: SourceReference[];
    createdAt: Date;
    updatedAt: Date;
}
