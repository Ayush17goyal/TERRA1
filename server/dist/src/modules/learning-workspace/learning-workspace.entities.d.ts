export declare class AiLearningSource {
    id: string;
    userId: string;
    kind: string;
    status: string;
    indexingProgress: number;
    documentType: string;
    subject: string;
    unit: string;
    topic: string;
    name: string;
    url: string;
    storagePath: string;
    mimeType: string;
    textLength: number;
    vectorId: string;
    metadata: any;
    text: string;
    createdAt: Date;
}
export declare class AiMockTest {
    id: string;
    userId: string;
    topic: string;
    difficulty: string;
    questionType: string;
    questionCount: number;
    mode: string;
    pdfUrl: string;
    sourceIds: string[];
    questions: any[];
    scoreReport: any;
    weakAreas: string[];
    createdAt: Date;
}
export declare class AiMockTestAttempt {
    id: string;
    userId: string;
    mockTestId: string;
    score: number;
    total: number;
    percentage: number;
    timeTaken: number;
    accuracy: number;
    answers: any;
    weakAreas: string[];
    createdAt: Date;
}
export declare class AiMindMap {
    id: string;
    userId: string;
    title: string;
    structureType: string;
    sourceIds: string[];
    map: any;
    concepts: string[];
    coverageMetrics: {
        totalConcepts: number;
        pagesAnalyzed: number;
        chunksUsed: number;
        sourceConfidence: number;
    };
    createdAt: Date;
}
export declare class AiStudyKit {
    id: string;
    userId: string;
    title: string;
    sourceIds: string[];
    content: any;
    createdAt: Date;
}
export declare class AiFlashcardReview {
    id: string;
    userId: string;
    studyKitId: string;
    cardId: string;
    rating: string;
    correct: boolean;
    topic: string;
    createdAt: Date;
}
export declare class AiLearningActivity {
    id: string;
    userId: string;
    action: string;
    metadata: any;
    createdAt: Date;
}
