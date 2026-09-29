import { KnowledgeLibraryStage, LibraryStatus } from '../knowledge-engine.types';
export declare class PersonalExamLibraryEntity {
    id: string;
    userId: string;
    status: LibraryStatus;
    currentStage: KnowledgeLibraryStage | null;
    topicsCount: number;
    subtopicsCount: number;
    definitionsCount: number;
    casesCount: number;
    illustrationsCount: number;
    coverageScore: number;
    confidenceScore: number;
    reviewReasons: string[];
    createdAt: Date;
    updatedAt: Date;
}
