import { CaseRecord, ComparisonRecord, DefinitionRecord, ExampleRecord, ExceptionRecord, PrincipleRecord, ProvisionRecord, SourceReference, TopicKeyword } from '../knowledge-engine.types';
export declare class TopicKnowledgeUnitEntity {
    id: string;
    userId: string;
    topic: string;
    subtopic: string;
    summary: string;
    definitions: DefinitionRecord[];
    legalProvisions: ProvisionRecord[];
    principles: PrincipleRecord[];
    exceptions: ExceptionRecord[];
    landmarkCases: CaseRecord[];
    referencedCases: CaseRecord[];
    illustrations: ExampleRecord[];
    examples: ExampleRecord[];
    comparisons: ComparisonRecord[];
    keywords: TopicKeyword[];
    references: SourceReference[];
    coverageScore: number;
    confidenceScore: number;
    version: number;
    lastUpdated: Date;
    createdAt: Date;
}
